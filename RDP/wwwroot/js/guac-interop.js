// wwwroot/js/guac-interop.js - SON HALİ

window.GuacInterop = {
    client: null,
    keyboard: null,
    mouse: null,
    touch: null,

    startClient: function (authToken, connectionId, displayElementId) {
        console.log('🚀 Guacamole başlatılıyor...');
        console.log('📌 Token:', authToken?.substring(0, 20) + '...');
        console.log('📌 Connection ID:', connectionId);

        // 1. Guacamole kütüphanesi kontrolü
        if (typeof Guacamole === 'undefined') {
            console.error("❌ Guacamole JS kütüphanesi yüklenemedi!");
            alert('Guacamole kütüphanesi yüklenemedi! Lütfen guacamole-common.js dosyasının doğru yüklendiğinden emin olun.');
            return;
        }

        // 2. Display elementini bul ve temizle
        const displayElement = document.getElementById(displayElementId);
        if (!displayElement) {
            console.error(`❌ Görüntü elementi bulunamadı: #${displayElementId}`);
            return;
        }
        while (displayElement.firstChild) {
            displayElement.removeChild(displayElement.firstChild);
        }

        try {
            // 3. DOĞRU Tünel Oluşturma: Guacamole.HTTPTunnel kullanılır.
            // Bu, WebSocket ve HTTP fallback mekanizmasını ve en önemlisi
            // session token yönetimini otomatik olarak halleder.
            // NOT: Blazor uygulamanız (https://localhost:7156) ve Guacamole sunucunuz (http://localhost:8080)
            // farklı portlarda olduğu için CORS sorunlarını önlemek amacıyla tam URL veriyoruz.
            // Production ortamında bu adresleri bir reverse proxy arkasında birleştirmek en iyi pratiktir.
            const tunnel = new Guacamole.HTTPTunnel("http://localhost:8080/#/websocket-tunnel");

            // 4. Tünel Olay Dinleyicileri (Event Listeners)
            tunnel.onerror = (status) => {
                console.error('❌ Tünel Hatası:', status);
                displayElement.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>❌ WebSocket Tünel Hatası</h5>
                        <p><strong>Kod:</strong> ${status.code} - <strong>Mesaj:</strong> ${status.message}</p>
                        <hr>
                        <small><strong>Kontrol Edin:</strong> Guacamole Docker container'ı çalışıyor mu ve 8080 portu açık mı?</small>
                    </div>`;
            };
            tunnel.onstatechange = (state) => {
                console.log('🔄 Tünel Durumu:', state); // 0: IDLE, 1: CONNECTING, 2: OPEN, 3: CLOSED
            };

            // 5. Guacamole Client Oluştur
            this.client = new Guacamole.Client(tunnel);

            // 6. Görüntüyü (Display) Ekrana Ekle
            const canvas = this.client.getDisplay().getElement();
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            displayElement.appendChild(canvas);
            console.log('✅ Canvas elementi eklendi');

            // 7. Client Durum Değişikliklerini İzle
            this.client.onstatechange = (state) => {
                console.log('🔄 Client Durumu:', state);
                // Detaylı loglama için switch-case yapısı önceki kodunuzdaki gibi kalabilir.
            };

            // 8. Client Hata Yönetimi
            this.client.onerror = (error) => {
                console.error('❌ Client Hatası:', error);
                displayElement.innerHTML = `
                    <div class="alert alert-danger m-3">
                        <h5>❌ RDP Bağlantı Hatası</h5>
                        <p>${error.message}</p>
                        <hr>
                        <small><strong>Olası Nedenler:</strong> RDP sunucu bilgileri (IP, port, kullanıcı, şifre) yanlış, sunucuya erişilemiyor veya guacd servisinde bir sorun var.</small>
                    </div>`;
            };

            // 9. Klavye ve Mouse Girdilerini Ayarla
            this.keyboard = new Guacamole.Keyboard(document);
            this.keyboard.onkeydown = (keysym) => { if (this.client) this.client.sendKeyEvent(1, keysym); };
            this.keyboard.onkeyup = (keysym) => { if (this.client) this.client.sendKeyEvent(0, keysym); };
            console.log('✅ Klavye dinleyicisi aktif');

            this.mouse = new Guacamole.Mouse(canvas);
            this.mouse.onmousedown = this.mouse.onmouseup = this.mouse.onmousemove = (mouseState) => {
                if (this.client) this.client.sendMouseState(mouseState);
            };
            console.log('✅ Mouse dinleyicisi aktif');

            this.touch = new Guacamole.Mouse.Touchpad(canvas);
            this.touch.onmousedown = this.touch.onmousemove = this.touch.onmouseup = (state) => {
                if (this.client) this.client.sendMouseState(state);
            };
            console.log('✅ Dokunmatik dinleyicisi aktif');

            // 10. BAĞLAN: Parametreler URL'de değil, connect() metoduna string olarak verilir.
            const connectionParams =
                `token=${encodeURIComponent(authToken)}` +
                `&GUAC_DATA_SOURCE=mysql` +
                `&GUAC_ID=${encodeURIComponent(connectionId)}` +
                `&GUAC_TYPE=c` +
                `&GUAC_WIDTH=${Math.floor(displayElement.clientWidth)}` +  // Dinamik genişlik
                `&GUAC_HEIGHT=${Math.floor(displayElement.clientHeight)}` + // Dinamik yükseklik
                `&GUAC_DPI=96`;

            this.client.connect(connectionParams);
            console.log('✅ client.connect() çağrıldı. Bağlantı bekleniyor...');

        } catch (ex) {
            console.error('❌ JavaScript Başlatma Hatası:', ex);
            displayElement.innerHTML = `<div class="alert alert-danger m-3"><h5>JS Hatası</h5><p>${ex.message}</p></div>`;
        }
    },

    disconnect: function () {
        if (this.client && this.client.getTunnel().state === Guacamole.Tunnel.State.OPEN) {
            console.log('🔌 Bağlantı kesiliyor...');
            this.client.disconnect();
        }
        this.client = null;
        console.log('✅ Bağlantı kesildi ve kaynaklar temizlendi.');
    }
};