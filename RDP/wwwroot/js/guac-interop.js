// wwwroot/js/guac-interop.js - OTOMATİK FULL-SCREEN VERSİYONU

window.GuacInterop = {
    client: null,
    keyboard: null,
    mouse: null,
    touch: null,

    startClient: function (authToken, connectionId, displayElementId) {
        console.log('🚀 Guacamole başlatılıyor...');
        console.log('📌 Token:', authToken?.substring(0, 20) + '...');
        console.log('📌 Connection ID:', connectionId);
        console.log('📌 Display Element:', displayElementId);

        // 1. Guacamole kütüphanesi kontrolü
        if (typeof Guacamole === 'undefined') {
            console.error("❌ Guacamole JS kütüphanesi yüklenemedi!");
            alert('Guacamole kütüphanesi yüklenemedi! guacamole-common.js dosyasını kontrol edin.');
            return;
        }

        // 2. Display elementini bul
        const displayElement = document.getElementById(displayElementId);
        if (!displayElement) {
            console.error(`❌ Display element bulunamadı: #${displayElementId}`);
            return;
        }

        // Önceki içeriği temizle
        while (displayElement.firstChild) {
            displayElement.removeChild(displayElement.firstChild);
        }

        try {
            // 3. HTTPTunnel Endpoint
            const tunnelUrl = "http://localhost:8080/tunnel";
            const tunnel = new Guacamole.HTTPTunnel(tunnelUrl);

            console.log('🔗 Tunnel URL:', tunnelUrl);

            // 4. Tunnel event handlers
            tunnel.onerror = (status) => {
                console.error('❌ Tunnel Hatası:', status);

                let errorMsg = '';
                switch (status.code) {
                    case 256: errorMsg = 'İstemci tarayıcı desteklenmiyor'; break;
                    case 512: errorMsg = 'Guacamole sunucu hatası'; break;
                    case 513: errorMsg = 'Sunucu meşgul, lütfen tekrar deneyin'; break;
                    case 514: errorMsg = 'RDP sunucusu zaman aşımına uğradı'; break;
                    case 515: errorMsg = 'RDP bağlantı hatası (kullanıcı/şifre kontrol edin)'; break;
                    case 516: errorMsg = 'Connection bulunamadı (ID: ' + connectionId + ')'; break;
                    case 519: errorMsg = 'RDP sunucusuna ulaşılamıyor (IP/Port kontrol edin)'; break;
                    case 768: errorMsg = 'Hatalı istek (Token veya parametreler geçersiz)'; break;
                    case 769: errorMsg = 'Yetkilendirme hatası (Token geçersiz)'; break;
                    default: errorMsg = `Bilinmeyen hata (Kod: ${status.code})`;
                }

                displayElement.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>❌ Bağlantı Hatası</h5>
                        <p><strong>Hata:</strong> ${errorMsg}</p>
                        <p><strong>Kod:</strong> ${status.code}</p>
                        ${status.message ? `<p><strong>Detay:</strong> ${status.message}</p>` : ''}
                        <hr>
                        <small>
                            <strong>Kontrol Edin:</strong><br>
                            • RDP sunucusu çalışıyor mu?<br>
                            • Kullanıcı adı ve şifre doğru mu?<br>
                            • Guacd servisine 'docker logs guacd' ile bakın
                        </small>
                    </div>
                `;
            };

            tunnel.onstatechange = (state) => {
                const states = ['IDLE', 'CONNECTING', 'OPEN', 'CLOSED'];
                console.log(`🔄 Tunnel State: ${states[state] || state}`);
            };

            // 5. Guacamole Client oluştur
            this.client = new Guacamole.Client(tunnel);

            // 6. Display (Canvas) ekle ve boyutlandır
            const display = this.client.getDisplay();
            const canvas = display.getElement();

            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';

            displayElement.appendChild(canvas);
            console.log('✅ Canvas eklendi');
            console.log('📐 Canvas boyut:', canvas.width, 'x', canvas.height);
            console.log('📐 Container boyut:', displayElement.clientWidth, 'x', displayElement.clientHeight);

            // 7. Client state tracking + OTOMATİK FULL-SCREEN
            this.client.onstatechange = (state) => {
                const states = ['IDLE', 'CONNECTING', 'WAITING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
                console.log(`🔄 Client State: ${states[state] || state}`);

                if (state === 3) { // CONNECTED
                    console.log('🎉 RDP BAŞARIYLA BAĞLANDI!');

                    // ✅ OTOMATİK FULL-SCREEN AKTİFLEŞTİR
                    setTimeout(() => {
                        this.enterFullScreen(displayElement);
                    }, 500);

                } else if (state === 5) { // DISCONNECTED
                    console.log('❌ Bağlantı kesildi');

                    // Full-screen'den çık
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(err => console.warn('Exit fullscreen error:', err));
                    }

                    displayElement.innerHTML = '<div class="text-white p-5 text-center">Bağlantı kesildi</div>';
                }
            };

            // 8. Client error handler
            this.client.onerror = (error) => {
                console.error('❌ Client Hatası:', error);
                displayElement.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>❌ RDP Client Hatası</h5>
                        <p>${error.message || 'Bilinmeyen hata'}</p>
                    </div>
                `;
            };

            // 9. Klavye girişi
            this.keyboard = new Guacamole.Keyboard(document);
            this.keyboard.onkeydown = (keysym) => {
                if (this.client) this.client.sendKeyEvent(1, keysym);
            };
            this.keyboard.onkeyup = (keysym) => {
                if (this.client) this.client.sendKeyEvent(0, keysym);
            };
            console.log('✅ Klavye aktif');

            // 10. Mouse girişi
            this.mouse = new Guacamole.Mouse(canvas);
            this.mouse.onmousedown =
                this.mouse.onmouseup =
                this.mouse.onmousemove = (mouseState) => {
                    if (this.client) this.client.sendMouseState(mouseState);
                };
            console.log('✅ Mouse aktif');

            // 11. Touch support (mobil)
            this.touch = new Guacamole.Mouse.Touchpad(canvas);
            this.touch.onmousedown =
                this.touch.onmousemove =
                this.touch.onmouseup = (state) => {
                    if (this.client) this.client.sendMouseState(state);
                };
            console.log('✅ Touch aktif');

            // 12. BAĞLAN
            const width = Math.floor(displayElement.clientWidth) || 1920;
            const height = Math.floor(displayElement.clientHeight) || 1080;

            const connectionParams =
                `token=${encodeURIComponent(authToken)}` +
                `&GUAC_DATA_SOURCE=mysql` +
                `&GUAC_ID=${encodeURIComponent(connectionId)}` +
                `&GUAC_TYPE=c` +
                `&GUAC_WIDTH=${width}` +
                `&GUAC_HEIGHT=${height}` +
                `&GUAC_DPI=96` +
                `&GUAC_AUDIO=audio/L16` +
                `&GUAC_IMAGE=image/png image/jpeg`;

            console.log('📤 Connection params:', connectionParams);

            this.client.connect(connectionParams);
            console.log('✅ client.connect() çağrıldı');

        } catch (ex) {
            console.error('❌ Başlatma hatası:', ex);
            displayElement.innerHTML = `
                <div class="alert alert-danger m-3">
                    <h5>❌ JavaScript Hatası</h5>
                    <p>${ex.message}</p>
                    <pre class="small">${ex.stack}</pre>
                </div>
            `;
        }
    },

    // ✅ FULL-SCREEN FONKSIYONU
    enterFullScreen: function (displayElement) {
        console.log('🖥️ Full-screen modu başlatılıyor...');

        // Full-screen API kontrolü
        if (!displayElement.requestFullscreen) {
            console.warn('⚠️ Bu tarayıcı Full-screen API desteklemiyor, responsive mode kullanılıyor');
            this.applyResponsiveScale(displayElement);
            return;
        }

        displayElement.requestFullscreen()
            .then(() => {
                console.log('✅ Full-screen modu aktif!');

                // Full-screen'de görüntüyü optimize et
                setTimeout(() => {
                    if (document.fullscreenElement && this.client) {
                        const display = this.client.getDisplay();

                        // Ekran boyutlarını al
                        const screenW = screen.width;
                        const screenH = screen.height;
                        const displayW = display.getWidth();
                        const displayH = display.getHeight();

                        console.log('📐 Ekran boyutu:', screenW, 'x', screenH);
                        console.log('📐 RDP boyutu:', displayW, 'x', displayH);

                        // Scale hesapla (aspect ratio korunarak)
                        const scale = Math.min(
                            screenW / displayW,
                            screenH / displayH
                        );

                        display.scale(scale);
                        console.log('📏 Full-screen scale uygulandı:', scale.toFixed(2));
                    }
                }, 300);

            })
            .catch((err) => {
                console.warn('⚠️ Full-screen reddedildi:', err.message);
                console.log('📱 Fallback: Responsive mode kullanılıyor');

                // Tarayıcı full-screen'i engellediyse, responsive mode kullan
                this.applyResponsiveScale(displayElement);
            });

        // ESC tuşu ile çıkış bildirimi
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                console.log('🔙 Full-screen modundan çıkıldı');

                // Normal responsive mode'a geri dön
                if (this.client) {
                    setTimeout(() => {
                        this.applyResponsiveScale(displayElement);
                    }, 100);
                }
            }
        }, { once: true });
    },

    // ✅ RESPONSIVE SCALE (Full-screen olmadan)
    applyResponsiveScale: function (displayElement) {
        if (!this.client) return;

        const display = this.client.getDisplay();
        const containerW = displayElement.clientWidth;
        const containerH = displayElement.clientHeight;
        const displayW = display.getWidth();
        const displayH = display.getHeight();

        if (displayW > 0 && displayH > 0) {
            const scale = Math.min(
                containerW / displayW,
                containerH / displayH
            );

            display.scale(scale);
            console.log('📏 Responsive scale uygulandı:', scale.toFixed(2));
        }
    },

    // ✅ BAĞLANTIYI KES
    disconnect: function () {
        console.log('🔌 Disconnecting...');

        // Full-screen'den çık
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.warn('Exit fullscreen error:', err));
        }

        if (this.client) {
            try {
                this.client.disconnect();
            } catch (ex) {
                console.warn('Disconnect warning:', ex);
            }
            this.client = null;
        }

        if (this.keyboard) {
            this.keyboard.reset();
            this.keyboard = null;
        }

        if (this.mouse) {
            this.mouse = null;
        }

        if (this.touch) {
            this.touch = null;
        }

        console.log('✅ Disconnected ve kaynaklar temizlendi');
    }
};