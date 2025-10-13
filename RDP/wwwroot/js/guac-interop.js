// wwwroot/js/guac-interop.js - ÇALIŞAN VERSİYON

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
            // 3. ✅ DOĞRU HTTPTunnel Endpoint
            // Önce hangi endpoint'in çalıştığını tespit et
            const tunnelUrl = "http://localhost:8080/tunnel"; // ROOT deployment için
            // Eğer /guacamole prefix'i varsa: "http://localhost:8080/guacamole/tunnel"

            const tunnel = new Guacamole.HTTPTunnel(tunnelUrl);

            console.log('🔗 Tunnel URL:', tunnelUrl);

            // 4. Tunnel event handlers
            tunnel.onerror = (status) => {
                console.error('❌ Tunnel Hatası:', status);

                let errorMsg = '';
                switch (status.code) {
                    case 256: // UNSUPPORTED
                        errorMsg = 'İstemci tarayıcı desteklenmiyor';
                        break;
                    case 512: // SERVER_ERROR
                        errorMsg = 'Guacamole sunucu hatası';
                        break;
                    case 513: // SERVER_BUSY
                        errorMsg = 'Sunucu meşgul, lütfen tekrar deneyin';
                        break;
                    case 514: // UPSTREAM_TIMEOUT
                        errorMsg = 'RDP sunucusu zaman aşımına uğradı';
                        break;
                    case 515: // UPSTREAM_ERROR
                        errorMsg = 'RDP bağlantı hatası (kullanıcı/şifre kontrol edin)';
                        break;
                    case 516: // RESOURCE_NOT_FOUND
                        errorMsg = 'Connection bulunamadı (ID: ' + connectionId + ')';
                        break;
                    case 517: // RESOURCE_CONFLICT
                        errorMsg = 'Bağlantı çakışması';
                        break;
                    case 518: // RESOURCE_CLOSED
                        errorMsg = 'Bağlantı kapatıldı';
                        break;
                    case 519: // UPSTREAM_NOT_FOUND
                        errorMsg = 'RDP sunucusuna ulaşılamıyor (IP/Port kontrol edin)';
                        break;
                    case 520: // UPSTREAM_UNAVAILABLE
                        errorMsg = 'RDP sunucusu kullanılamıyor';
                        break;
                    case 521: // SESSION_CONFLICT
                        errorMsg = 'Oturum çakışması';
                        break;
                    case 522: // SESSION_TIMEOUT
                        errorMsg = 'Oturum zaman aşımı';
                        break;
                    case 523: // SESSION_CLOSED
                        errorMsg = 'Oturum kapatıldı';
                        break;
                    case 768: // CLIENT_BAD_REQUEST
                        errorMsg = 'Hatalı istek (Token veya parametreler geçersiz)';
                        break;
                    case 769: // CLIENT_UNAUTHORIZED
                        errorMsg = 'Yetkilendirme hatası (Token geçersiz)';
                        break;
                    case 771: // CLIENT_FORBIDDEN
                        errorMsg = 'Erişim reddedildi';
                        break;
                    case 776: // CLIENT_NOT_FOUND
                        errorMsg = 'Kaynak bulunamadı';
                        break;
                    case 781: // CLIENT_TIMEOUT
                        errorMsg = 'İstemci zaman aşımı';
                        break;
                    default:
                        errorMsg = `Bilinmeyen hata (Kod: ${status.code})`;
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
                            • RDP sunucusu çalışıyor mu? (${connectionId} ID'li connection)<br>
                            • Kullanıcı adı ve şifre doğru mu?<br>
                            • Guacamole MySQL'de connection kaydı var mı?<br>
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

            // 6. Display (Canvas) ekle
            const canvas = this.client.getDisplay().getElement();
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            displayElement.appendChild(canvas);
            console.log('✅ Canvas eklendi');

            // 7. Client state tracking
            this.client.onstatechange = (state) => {
                const states = ['IDLE', 'CONNECTING', 'WAITING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
                console.log(`🔄 Client State: ${states[state] || state}`);

                if (state === 3) { // CONNECTED
                    console.log('🎉 RDP BAŞARIYLA BAĞLANDI!');
                } else if (state === 5) { // DISCONNECTED
                    console.log('❌ Bağlantı kesildi');
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

            // 12. ✅ BAĞLAN - Parametreleri string olarak gönder
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

    disconnect: function () {
        console.log('🔌 Disconnecting...');

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