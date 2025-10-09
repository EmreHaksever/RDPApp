// wwwroot/js/guac-interop.js

window.GuacInterop = {
    startClient: function (websocketUrl, tunnelKey, displayElementId) {

        // 1. Guacamole Kütüphanesinin Yüklü Olduğundan Emin Olun
        // Bu kısım için index.html'e <script src="guacamole-common.js"></script> eklenmeli.
        if (typeof Guacamole === 'undefined') {
            console.error("Guacamole JS client library (guacamole-common.js) is not loaded.");
            return;
        }

        // 2. Guacamole İstemcisini Başlat
        var client = new Guacamole.Client(
            new Guacamole.WebSocketTunnel(websocketUrl + "?guac.resource=mysql&guac.id=" + tunnelKey)
        );

        // 3. Görüntüleme Alanını Ayarla
        var displayElement = document.getElementById(displayElementId);
        if (displayElement) {
            // Display'i HTML elementine ekle (Bu bir Canvas olacaktır)
            displayElement.appendChild(client.getDisplay().getElement());
        }

        // 4. Olay Dinleyicileri
        client.onstatechange = function (state) {
            console.log("Guacamole State Changed:", state);
            // Bağlantı durumlarını burada Blazor'a bildirebilirsiniz (Örn: Bağlandı, Hata, Koptu)
            // if (state === Guacamole.Client.State.CONNECTED) { ... }
        };

        client.onerror = function (error) {
            console.error("Guacamole Hata:", error.message);
            // Hata mesajını Blazor'a göndermek için JSRuntime çağrılabilir.
        };

        // 5. Giriş Cihazlarını Ayarla (Klavye, Fare)
        var mouse = new Guacamole.Mouse(client.getDisplay().getElement());
        mouse.onmousemove = mouse.onmousedown = mouse.onmouseup = function (mouseState) {
            client.sendMouse(mouseState);
        };

        var keyboard = new Guacamole.Keyboard(document);
        keyboard.onkeydown = function (keysym) {
            client.sendKeyEvent(1, keysym);
        };
        keyboard.onkeyup = function (keysym) {
            client.sendKeyEvent(0, keysym);
        };

        // 6. Bağlan!
        client.connect();
    }
};