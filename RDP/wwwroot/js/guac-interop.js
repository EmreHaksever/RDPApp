// wwwroot/js/guac-interop.js - DÜZELTME

window.GuacInterop = {
    client: null,

    startClient: function (authToken, connectionId, displayElementId) {
        console.log('🚀 Guacamole başlatılıyor...');
        console.log('📌 Token:', authToken?.substring(0, 20) + '...');
        console.log('📌 Connection ID:', connectionId);

        // 1. Guacamole kütüphanesi kontrolü
        if (typeof Guacamole === 'undefined') {
            console.error("❌ Guacamole JS kütüphanesi yüklenemedi!");
            alert('Guacamole kütüphanesi yüklenemedi! guacamole-common.js kontrol edin.');
            return;
        }

        // 2. Display element
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
            // 3. KRİTİK DÜZELTME: WebSocket URL'ini DOĞRU oluştur
            // Guacamole Docker'ın root path'inde çalışıyor, /guacamole prefix'i YOK
            const wsUrl = `ws://localhost:8080/websocket-tunnel` +
                `?token=${encodeURIComponent(authToken)}` +
                `&GUAC_DATA_SOURCE=mysql` +
                `&GUAC_ID=${encodeURIComponent(connectionId)}` +
                `&GUAC_TYPE=c` +
                `&GUAC_WIDTH=1920` +
                `&GUAC_HEIGHT=1080` +
                `&GUAC_DPI=96`;

            console.log('🔗 WebSocket URL:', wsUrl);

            // 4. WebSocket Tunnel oluştur
            const tunnel = new Guacamole.WebSocketTunnel(wsUrl);

            // Tunnel event'leri
            tunnel.onerror = (status) => {
                console.error('❌ Tunnel Hatası:', status);
                displayElement.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>❌ WebSocket Hatası</h5>
                        <p><strong>Kod:</strong> ${status.code}</p>
                        <p><strong>Mesaj:</strong> ${status.message || 'Bağlantı başarısız'}</p>
                        <hr>
                        <small>
                            <strong>Kontrol Edin:</strong><br>
                            • Guacamole çalışıyor mu? → docker ps<br>
                            • Guacd çalışıyor mu? → docker logs guacd<br>
                            • RDP hedef erişilebilir mi?<br>
                            • Token geçerli mi?
                        </small>
                    </div>
                `;
            };

            tunnel.onstatechange = (state) => {
                console.log('🔄 Tunnel State:', state);
            };

            // 5. Guacamole Client oluştur
            this.client = new Guacamole.Client(tunnel);

            // 6. Display ekle
            const canvas = this.client.getDisplay().getElement();
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            displayElement.appendChild(canvas);
            console.log('✅ Canvas eklendi');

            // 7. Client state tracking
            this.client.onstatechange = (state) => {
                console.log('🔄 Client State:', state);

                switch (state) {
                    case Guacamole.Client.State.IDLE:
                        console.log('⏸️ IDLE');
                        break;
                    case Guacamole.Client.State.CONNECTING:
                        console.log('🔄 CONNECTING...');
                        break;
                    case Guacamole.Client.State.WAITING:
                        console.log('⏳ WAITING...');
                        break;
                    case Guacamole.Client.State.CONNECTED:
                        console.log('🎉 CONNECTED! RDP Başarıyla Bağlandı!');
                        break;
                    case Guacamole.Client.State.DISCONNECTING:
                        console.log('🔌 DISCONNECTING...');
                        break;
                    case Guacamole.Client.State.DISCONNECTED:
                        console.log('❌ DISCONNECTED');
                        displayElement.innerHTML = '<div class="text-white p-5 text-center">Bağlantı kesildi</div>';
                        break;
                }
            };

            // 8. Client error
            this.client.onerror = (error) => {
                console.error('❌ Client Hatası:', error);

                let errorMsg = error.message || 'Bilinmeyen hata';

                displayElement.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>❌ RDP Bağlantı Hatası</h5>
                        <p>${errorMsg}</p>
                        <hr>
                        <small>
                            <strong>Olası Nedenler:</strong><br>
                            • RDP sunucusu kapalı veya erişilemiyor<br>
                            • Kullanıcı adı/şifre hatalı<br>
                            • Guacd servisi RDP'ye bağlanamıyor<br>
                            • Firewall 3389 portunu engelliyor
                        </small>
                    </div>
                `;
            };

            // 9. Klavye input
            const keyboard = new Guacamole.Keyboard(document);

            keyboard.onkeydown = (keysym) => {
                this.client.sendKeyEvent(1, keysym);
            };

            keyboard.onkeyup = (keysym) => {
                this.client.sendKeyEvent(0, keysym);
            };

            console.log('✅ Klavye aktif');

            // 10. Mouse input
            const mouse = new Guacamole.Mouse(canvas);

            mouse.onmousedown =
                mouse.onmouseup =
                mouse.onmousemove = (mouseState) => {
                    this.client.sendMouseState(mouseState);
                };

            console.log('✅ Mouse aktif');

            // 11. Touch support (mobil)
            const touch = new Guacamole.Mouse.Touchpad(canvas);

            touch.onmousedown =
                touch.onmousemove =
                touch.onmouseup = (state) => {
                    this.client.sendMouseState(state);
                };

            // 12. BAĞLAN!
            this.client.connect();
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
            this.client.disconnect();
            this.client = null;
        }

        console.log('✅ Disconnected');
    }
};