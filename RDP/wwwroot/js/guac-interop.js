// wwwroot/js/guac-interop.js - DÜZELTİLMİŞ FULL-SCREEN VERSİYONU

window.GuacInterop = {
    client: null,
    keyboard: null,
    mouse: null,
    touch: null,

    // 1. Client Başlatma
    startClient: function (authToken, connectionId, displayElementId) {
        console.log('🚀 Guacamole başlatılıyor...');
        console.log('📌 Token:', authToken?.substring(0, 20) + '...');
        console.log('📌 Connection ID:', connectionId);

        // Guacamole kütüphanesi kontrolü
        if (typeof Guacamole === 'undefined') {
            console.error("❌ Guacamole JS kütüphanesi yüklenemedi!");
            alert('Guacamole kütüphanesi yüklenemedi! guacamole-common.js dosyasını kontrol edin.');
            return;
        }

        // Display elementini bul
        const displayElement = document.getElementById(displayElementId);
        if (!displayElement) {
            console.error(`❌ Display element bulunamadı: #${displayElementId}`);
            return;
        }

        // Önceki içeriği temizle
        displayElement.innerHTML = "";

        try {
            // WebSocket Tunnel Endpoint (Dikkat: HTTPTunnel yerine WebSocketTunnel daha performanslıdır)
            // Eğer docker ayarlarında ws:// kullanıyorsan burayı WebSocketTunnel yapmalısın.
            // Kodunda HTTPTunnel vardı, aynen bırakıyorum ama performans için WebSocketTunnel önerilir.
            // const tunnelUrl = "ws://localhost:8080/tunnel"; 
            const tunnelUrl = "http://localhost:8080/tunnel";
            const tunnel = new Guacamole.HTTPTunnel(tunnelUrl);

            // Tunnel event handlers
            tunnel.onerror = (status) => {
                console.error('❌ Tunnel Hatası:', status);
                let errorMsg = '';
                switch (status.code) {
                    case 256: errorMsg = 'İstemci tarayıcı desteklenmiyor'; break;
                    case 512: errorMsg = 'Guacamole sunucu hatası'; break;
                    case 513: errorMsg = 'Sunucu meşgul'; break;
                    case 514: errorMsg = 'Zaman aşımı'; break;
                    case 515: errorMsg = 'Yetkilendirme/Bağlantı hatası'; break;
                    case 519: errorMsg = 'Sunucuya ulaşılamıyor'; break;
                    default: errorMsg = `Hata Kodu: ${status.code}`;
                }
                displayElement.innerHTML = `<div class="alert alert-danger m-3">${errorMsg}</div>`;
            };

            // Guacamole Client oluştur
            this.client = new Guacamole.Client(tunnel);

            // Display (Canvas) ekle
            const display = this.client.getDisplay();
            const canvas = display.getElement();

            // Canvas Stilleri
            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';

            displayElement.appendChild(canvas);

            // Client state tracking + OTOMATİK FULL-SCREEN
            this.client.onstatechange = (state) => {
                const states = ['IDLE', 'CONNECTING', 'WAITING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
                console.log(`🔄 Client State: ${states[state] || state}`);

                if (state === 3) { // CONNECTED
                    console.log('🎉 RDP BAŞARIYLA BAĞLANDI!');

                    // Otomatik Full-Screen (İsteğe bağlı, tarayıcı izin verirse)
                    setTimeout(() => {
                        this.enterFullScreen(displayElement);
                    }, 500);

                } else if (state === 5) { // DISCONNECTED
                    console.log('❌ Bağlantı kesildi');
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => { });
                    }
                    displayElement.innerHTML = '<div class="text-white p-5 text-center">Bağlantı sonlandı.</div>';
                }
            };

            this.client.onerror = (error) => {
                console.error('❌ Client Hatası:', error);
            };

            // Giriş Aygıtları (Klavye & Mouse)
            this.keyboard = new Guacamole.Keyboard(document);
            this.keyboard.onkeydown = (keysym) => { if (this.client) this.client.sendKeyEvent(1, keysym); };
            this.keyboard.onkeyup = (keysym) => { if (this.client) this.client.sendKeyEvent(0, keysym); };

            this.mouse = new Guacamole.Mouse(canvas);
            this.mouse.onmousedown = this.mouse.onmouseup = this.mouse.onmousemove = (state) => {
                if (this.client) this.client.sendMouseState(state);
            };

            // BAĞLAN
            const width = Math.floor(displayElement.clientWidth) || 1024;
            const height = Math.floor(displayElement.clientHeight) || 768;

            const params = `token=${encodeURIComponent(authToken)}` +
                `&GUAC_DATA_SOURCE=mysql` +
                `&GUAC_ID=${encodeURIComponent(connectionId)}` +
                `&GUAC_TYPE=c` +
                `&GUAC_WIDTH=${width}` +
                `&GUAC_HEIGHT=${height}`;

            this.client.connect(params);

        } catch (ex) {
            console.error('❌ Başlatma hatası:', ex);
        }
    },

    // 2. Full Screen Modu
    enterFullScreen: function (displayElement) {
        if (!displayElement.requestFullscreen) {
            this.applyResponsiveScale(displayElement);
            return;
        }
        displayElement.requestFullscreen().then(() => {
            setTimeout(() => {
                if (this.client) {
                    const display = this.client.getDisplay();
                    const scale = Math.min(screen.width / display.getWidth(), screen.height / display.getHeight());
                    display.scale(scale);
                }
            }, 300);
        }).catch((err) => {
            console.warn('⚠️ Full-screen reddedildi:', err.message);
            this.applyResponsiveScale(displayElement);
        });

        // ESC ile çıkıldığında scale düzelt
        displayElement.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && this.client) {
                this.applyResponsiveScale(displayElement);
            }
        });
    },

    // 3. Responsive Scale
    applyResponsiveScale: function (displayElement) {
        if (!this.client) return;
        const display = this.client.getDisplay();
        const scale = Math.min(
            displayElement.clientWidth / display.getWidth(),
            displayElement.clientHeight / display.getHeight()
        );
        display.scale(scale);
    },

    // 4. Bağlantı Kesme ve Temizleme
    disconnect: function () {
        console.log('🔌 Disconnecting...');

        // Full-screen çıkış
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        // Client durdur
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        // Listener temizle
        if (this.keyboard) {
            this.keyboard.onkeydown = null;
            this.keyboard.onkeyup = null;
            this.keyboard = null;
        }
        if (this.mouse) {
            this.mouse.onmousedown = null;
            this.mouse.onmouseup = null;
            this.mouse.onmousemove = null;
            this.mouse = null;
        }

        // Ekranı temizle
        const display = document.getElementById("guacamole-display");
        if (display) display.innerHTML = "";

        console.log('✅ Temizlendi.');
    }
};