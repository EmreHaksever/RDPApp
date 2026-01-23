window.GuacInterop = {
    client: null,
    keyboard: null,
    mouse: null,
    touch: null,
    displayElement: null,
    resizeTimeout: null,

    // 1. Client Başlatma
    startClient: function (authToken, connectionId, displayElementId) {
        console.log('🚀 Guacamole başlatılıyor...');

        // Elementi bul ve global değişkene ata
        this.displayElement = document.getElementById(displayElementId);
        if (!this.displayElement) {
            console.error(`❌ Display element bulunamadı: #${displayElementId}`);
            return;
        }

        // Önceki içeriği temizle
        this.displayElement.innerHTML = "";

        if (typeof Guacamole === 'undefined') {
            alert('Hata: Guacamole JS kütüphanesi yüklenemedi.');
            return;
        }

        try {
            // Tunnel (SSL kullanıyorsan wss:// veya https:// yapmalısın)
            const tunnelUrl = "http://localhost:8080/tunnel";
            const tunnel = new Guacamole.HTTPTunnel(tunnelUrl);

            // Client oluştur
            this.client = new Guacamole.Client(tunnel);

            // Display (Canvas)
            const display = this.client.getDisplay();
            const canvas = display.getElement();

            // Canvas stilleri (Başlangıç)
            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.cursor = 'none'; // RDP içinde mouse gizlensin

            this.displayElement.appendChild(canvas);

            // YENİ EKLENEN KISIM: Sürükle Bırak Olaylarını Yakalama
            // ============================================================

            // 1. Tarayıcının dosyayı açmasını engelle
            const stopBrowserAction = (e) => {
                e.stopPropagation();
                e.preventDefault();
            };

            this.displayElement.addEventListener('dragenter', stopBrowserAction);
            this.displayElement.addEventListener('dragover', stopBrowserAction);

            // 2. Dosya bırakıldığında yakala ve sunucuya gönder
            this.displayElement.addEventListener('drop', (e) => {
                stopBrowserAction(e);

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        this.uploadFile(files[i]);
                    }
                }
            });
            // ============================================================

            // --- EVENTLER ---

            this.client.onerror = (error) => console.error('Client Hatası:', error);
            tunnel.onerror = (status) => console.error('Tunnel Hatası:', status);

            this.client.onstatechange = (state) => {
                if (state === 3) { // CONNECTED
                    console.log("✅ Bağlandı.");

                    // Bağlantı kurulunca ilk oturtmayı yap
                    this.applyResponsiveScale();

                    // İlk açılışta otomatik tam ekran (İsteğe bağlı)
                    setTimeout(() => { this.enterFullScreen(); }, 500);

                    // Pencere boyutu değişirse yeniden sığdır
                    window.addEventListener('resize', this.handleResize);
                }
                else if (state === 5) { // DISCONNECTED
                    console.log("❌ Bağlantı kesildi.");
                    window.removeEventListener('resize', this.handleResize);
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => { });
                    }
                    this.displayElement.innerHTML = '<div class="text-white p-5 text-center">Bağlantı sonlandı.</div>';
                }
            };

            // Giriş Aygıtları
            this.keyboard = new Guacamole.Keyboard(document);
            this.keyboard.onkeydown = (keysym) => { if (this.client) this.client.sendKeyEvent(1, keysym); };
            this.keyboard.onkeyup = (keysym) => { if (this.client) this.client.sendKeyEvent(0, keysym); };

            this.mouse = new Guacamole.Mouse(canvas);
            this.mouse.onmousedown = this.mouse.onmouseup = this.mouse.onmousemove = (state) => {
                if (this.client) this.client.sendMouseState(state);
            };

            // --- BAĞLAN ---
            const width = Math.floor(this.displayElement.clientWidth) || 1024;
            const height = Math.floor(this.displayElement.clientHeight) || 768;

            const params = `token=${encodeURIComponent(authToken)}` +
                `&GUAC_DATA_SOURCE=mysql` +
                `&GUAC_ID=${encodeURIComponent(connectionId)}` +
                `&GUAC_TYPE=c` +
                `&GUAC_WIDTH=${width}` +
                `&GUAC_HEIGHT=${height}` +
                `&GUAC_DPI=96`;

            // YENİ EKLENEN KISIM: Dosya İndirme (Download) Olayını Yakalama
            // ============================================================
            this.client.onfile = (stream, mimetype, filename) => {
                console.log(`📥 Dosya indirme isteği geldi: ${filename}`);

                // Dosya parçalarını birleştirmek için BlobReader kullan
                const reader = new Guacamole.BlobReader(stream, mimetype);

                // İndirme tamamlandığında çalışacak kod
                reader.onend = () => {
                    const blob = reader.getBlob();

                    // Sanal bir <a> etiketi oluşturup tıklatarak indirmeyi başlat
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();

                    // Temizlik
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 100);

                    console.log("✅ Dosya başarıyla indirildi.");
                };

                // Veriyi almaya başla (Acknowledge)
                // Bu komut sunucuya "Hazırım, gönder" der.
                stream.sendAck("OK", 0x0000);
            };
            // ============================================================

            this.client.connect(params);

            // Fullscreen değişikliklerini dinle (ESC basıldığında scale düzelsin diye)
            document.addEventListener('fullscreenchange', () => {
                setTimeout(() => { this.applyResponsiveScale(); }, 100);
            });

        } catch (ex) {
            console.error('Başlatma hatası:', ex);
        }
    },

    // YENİ EKLENEN FONKSİYON: Dosyayı Guacamole Stream'ine Yazma
    // ============================================================
    uploadFile: function (file) {
        if (!this.client) return;

        console.log(`📤 Dosya yükleniyor: ${file.name} (${file.size} bytes)`);

        // Guacamole Client üzerinden dosya akışı (stream) oluştur
        const stream = this.client.createFileStream(file.type, file.name);

        // BlobWriter, dosyayı parçalara bölüp göndermeyi kolaylaştırır
        // Not: Guacamole-common-js kütüphanesinde yer alır
        const writer = new Guacamole.BlobWriter(stream);

        writer.oncomplete = function () {
            console.log("✅ Yükleme tamamlandı.");
        };

        writer.onerror = function (status, statusText) {
            console.error("❌ Yükleme hatası:", status, statusText);
        };

        // Dosyayı gönder ve akışı kapat
        writer.send(file);
        writer.close();
    },

    // 2. Full Screen Modu (GÜNCELLENDİ: Parametre almaz, global elementi kullanır)
    enterFullScreen: function () {
        const el = this.displayElement;
        if (!el) {
            console.warn('⚠️ Display element bulunamadı, tam ekran yapılamıyor.');
            return;
        }

        if (!document.fullscreenElement) {
            if (el.requestFullscreen) {
                el.requestFullscreen().then(() => {
                    console.log('✅ Full-screen aktif');
                    // Tam ekrana geçince scale'i güncelle
                    setTimeout(() => { this.applyResponsiveScale(); }, 300);
                }).catch((err) => {
                    console.warn('⚠️ Full-screen reddedildi:', err.message);
                });
            }
        }
    },



    // 3. Responsive Scale (Akıllı Sığdırma ve Ortalama)
    applyResponsiveScale: function () {
        if (!this.client || !this.displayElement) return;

        const display = this.client.getDisplay();
        const canvas = display.getElement();

        // Container boyutlarını al (Tam ekran veya normal)
        let containerWidth, containerHeight;

        if (document.fullscreenElement) {
            containerWidth = window.innerWidth;
            containerHeight = window.innerHeight;
        } else {
            containerWidth = this.displayElement.clientWidth;
            containerHeight = this.displayElement.clientHeight;
        }

        // RDP Orijinal Boyutları
        const displayWidth = display.getWidth();
        const displayHeight = display.getHeight();

        if (displayWidth === 0 || displayHeight === 0) return;

        // En-boy oranını koruyarak sığdırma çarpanı
        const scaleX = containerWidth / displayWidth;
        const scaleY = containerHeight / displayHeight;
        const scale = Math.min(scaleX, scaleY);

        // Scale uygula
        display.scale(scale);

        // Canvas'ı matematiksel olarak ortala
        const scaledWidth = displayWidth * scale;
        const scaledHeight = displayHeight * scale;

        canvas.style.width = scaledWidth + 'px';
        canvas.style.height = scaledHeight + 'px';

        // Left ve Top değerleri ile tam ortaya koy
        canvas.style.left = ((containerWidth - scaledWidth) / 2) + 'px';
        canvas.style.top = ((containerHeight - scaledHeight) / 2) + 'px';

        console.log(`📏 Scale: ${scale.toFixed(3)} | Container: ${containerWidth}x${containerHeight}`);
    },

    // Resize Handler (Debounce ile performanslı çalışma)
    handleResize: function () {
        if (window.GuacInterop.resizeTimeout) clearTimeout(window.GuacInterop.resizeTimeout);
        window.GuacInterop.resizeTimeout = setTimeout(() => {
            window.GuacInterop.applyResponsiveScale();
        }, 100);
    },

    // 4. Bağlantı Kesme
    disconnect: function () {
        console.log('🔌 Disconnecting...');

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        window.removeEventListener('resize', this.handleResize);

        if (this.keyboard) { this.keyboard.onkeydown = null; this.keyboard.onkeyup = null; this.keyboard = null; }
        if (this.mouse) { this.mouse.onmousedown = null; this.mouse.onmouseup = null; this.mouse.onmousemove = null; this.mouse = null; }

        if (this.displayElement) this.displayElement.innerHTML = "";
        this.displayElement = null;

        console.log('✅ Temizlendi.');
    }
};