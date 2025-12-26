

function noviando() {
    //morra si sigues aqui estamos noviando
}


function putos() {
    // persona que lo lea
    // persona que vino hasta aqui 
}

// Animación del gorro: secuencia de imágenes/GIFs, 5s cada una, en bucle
window.addEventListener('DOMContentLoaded', function () {
    var topHat = document.getElementById('profileHat');
    var modalHat = document.querySelector('.profile-modal-hat');

    if (!topHat && !modalHat) return;

    // Lista de imágenes/gifs del gorro.
    // Para agregar más, solo añade nuevas rutas al arreglo.
    var hatImages = [
        'gorrito-navidad.png',
        '2026.gif',
        '2026amarillo.gif',
        'santa-claus.gif',
        'artificial1.gif',
        'year.gif',
        'artificial2.gif',
        // 'otra-imagen.png',
        // 'otro-gif.gif'
    ];

    if (!hatImages.length) return;

    var currentIndex = 0;
    var displayTime = 5000; // 5 segundos por imagen/gif

    function applyImage() {
        var src = hatImages[currentIndex];
        if (topHat) topHat.src = src;
        if (modalHat) modalHat.src = src;
    }

    function nextImage() {
        currentIndex = (currentIndex + 1) % hatImages.length;
        applyImage();
    }

    // Mostrar la primera imagen al cargar
    applyImage();

    // Cambiar de imagen cada 5 segundos
    setInterval(nextImage, displayTime);
});

