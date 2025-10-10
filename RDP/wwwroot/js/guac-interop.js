// wwwroot/js/guac-interop.js (SON SÜRÜM - DOĞRU URL İLE)

window.GuacInterop = {
    startClient: function (authToken, connectionId, displayElementId) {

        if (typeof Guacamole === 'undefined') {
            console.error("Guacamole JS kütüphanesi yüklenemedi.");
            return;
        }

        // ==========================================================
        // ===== ANA DEĞİŞİKLİK BURADA ==============================
        // ==========================================================
        // "/guacamole" kısmı, sizin kurulumunuz ana dizinde çalıştığı için kaldırıldı.
        const tunnelUrl = "ws://localhost:8080/tunnel";

        const tunnel = new Guacamole.WebSocketTunnel(tunnelUrl);
        const client = new Guacamole.Client(tunnel);

        const displayElement = document.getElementById(displayElementId);
        if (displayElement) {
            while (displayElement.firstChild) {
                displayElement.removeChild(displayElement.firstChild);
            }
            displayElement.appendChild(client.getDisplay().getElement());
        }

        client.onerror = function (error) {
            console.error("Guacamole Client Hatası:", error);
            alert("Bağlantı Hatası: " + error.message);
            client.disconnect();
        };

        client.onstatechange = function (clientState) {
            if (clientState === 3) {
                console.log("Guacamole client bağlandı.");
            }
        };

        const connectionParams = "token=" + encodeURIComponent(authToken) + "&id=c%2F" + encodeURIComponent(connectionId);
        client.connect(connectionParams);
    }
};