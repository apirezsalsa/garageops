// Función para procesar, recortar al centro en cuadrado (1:1) y optimizar fotos del usuario
export const optimizeImageFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const CROP_SIZE = 500; // Recorte cuadrado 1:1 optimizado para iconos y fotos

        canvas.width = CROP_SIZE;
        canvas.height = CROP_SIZE;
        const ctx = canvas.getContext('2d');

        // Calcular recorte central (Center Crop 1:1)
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, CROP_SIZE, CROP_SIZE);

        // Convertir a WebP ligero a 80% calidad
        const dataUrl = canvas.toDataURL('image/webp', 0.80);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
