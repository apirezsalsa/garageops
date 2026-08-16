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

// Redimensiona (sin recortar, respeta el aspecto) y comprime una foto de ticket/factura antes de
// subirla a Storage. A diferencia de optimizeImageFile, aquí NO se recorta a cuadrado — un recibo
// suele ser una foto vertical alargada y recortarlo perdería texto importante.
export const optimizeReceiptImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob); else reject(new Error('No se pudo procesar la imagen'));
        }, 'image/webp', 0.85);
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
