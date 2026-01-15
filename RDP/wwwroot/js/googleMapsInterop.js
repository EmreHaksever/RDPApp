let map, marker, geocoder;

window.initMapPicker = (elementId, dotNetHelper) => {
    const initialCoords = { lat: 41.0082, lng: 28.9784 }; // İstanbul

    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map(document.getElementById(elementId), {
        center: initialCoords,
        zoom: 13,
        mapTypeControl: false
    });

    marker = new google.maps.Marker({
        position: initialCoords,
        map: map,
        draggable: true // Marker sürüklenebilir olsun
    });

    // Haritaya tıklandığında marker'ı oraya taşı
    map.addListener("click", (mapsMouseEvent) => {
        updateLocation(mapsMouseEvent.latLng, dotNetHelper);
    });

    // Marker sürüklendiğinde koordinatları güncelle
    marker.addListener("dragend", () => {
        updateLocation(marker.getPosition(), dotNetHelper);
    });
};

// Konumu güncelleyen ve C# tarafına haber veren yardımcı fonksiyon
function updateLocation(latLng, dotNetHelper) {
    marker.setPosition(latLng);
    map.panTo(latLng);

    // C# tarafındaki 'UpdateCoordinates' metodunu çağırıyoruz
    dotNetHelper.invokeMethodAsync('UpdateCoordinates', latLng.lat(), latLng.lng());
}

// "Konumu Bul" butonu için arama fonksiyonu
window.searchLocation = (address, dotNetHelper) => {
    geocoder.geocode({ address: address }, (results, status) => {
        if (status === "OK") {
            const loc = results[0].geometry.location;
            updateLocation(loc, dotNetHelper);
        } else {
            alert("Konum bulunamadı: " + status);
        }
    });
};