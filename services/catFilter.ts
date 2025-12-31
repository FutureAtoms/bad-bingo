/**
 * Cat Filter Service
 * Applies cat-themed AR filters to photos using Canvas API
 * Supports multiple filter styles: classic, anime, cyberpunk, whiskers-only
 */

// Cat filter types available in the app
export type CatFilterType = 'classic' | 'anime' | 'cyberpunk' | 'whiskers' | 'none';

export interface CatFilterConfig {
  id: CatFilterType;
  name: string;
  description: string;
  icon: string;
  earsColor: string;
  noseColor: string;
  whiskersColor: string;
  glowColor?: string;
}

// Available cat filter styles
export const CAT_FILTERS: CatFilterConfig[] = [
  {
    id: 'none',
    name: 'No Filter',
    description: 'Keep it real',
    icon: 'fa-ban',
    earsColor: 'transparent',
    noseColor: 'transparent',
    whiskersColor: 'transparent',
  },
  {
    id: 'classic',
    name: 'Classic Cat',
    description: 'Orange tabby vibes',
    icon: 'fa-cat',
    earsColor: '#FF9B50',
    noseColor: '#FFB4A2',
    whiskersColor: '#333333',
  },
  {
    id: 'anime',
    name: 'Anime Neko',
    description: 'Kawaii desu~',
    icon: 'fa-star',
    earsColor: '#FFB6C1',
    noseColor: '#FF69B4',
    whiskersColor: '#FFFFFF',
    glowColor: '#FF69B4',
  },
  {
    id: 'cyberpunk',
    name: 'Cyber Cat',
    description: 'Neon stray vibes',
    icon: 'fa-bolt',
    earsColor: '#00FF88',
    noseColor: '#00FFFF',
    whiskersColor: '#FF00FF',
    glowColor: '#00FF88',
  },
  {
    id: 'whiskers',
    name: 'Just Whiskers',
    description: 'Subtle stray energy',
    icon: 'fa-minus',
    earsColor: 'transparent',
    noseColor: 'transparent',
    whiskersColor: '#333333',
  },
];

export interface FaceDetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  leftEye?: { x: number; y: number };
  rightEye?: { x: number; y: number };
  nose?: { x: number; y: number };
  mouth?: { x: number; y: number };
}

/**
 * Simple face detection using basic heuristics
 * For production, integrate face-api.js or jeelizFaceFilter
 * This provides a fallback that estimates face position from image center
 */
export const detectFaceSimple = async (
  imageData: string
): Promise<FaceDetectionResult | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Simple heuristic: assume face is centered in upper portion
      const faceWidth = img.width * 0.5;
      const faceHeight = img.height * 0.5;
      const faceX = (img.width - faceWidth) / 2;
      const faceY = img.height * 0.1;

      resolve({
        x: faceX,
        y: faceY,
        width: faceWidth,
        height: faceHeight,
        leftEye: { x: faceX + faceWidth * 0.3, y: faceY + faceHeight * 0.35 },
        rightEye: { x: faceX + faceWidth * 0.7, y: faceY + faceHeight * 0.35 },
        nose: { x: faceX + faceWidth * 0.5, y: faceY + faceHeight * 0.55 },
        mouth: { x: faceX + faceWidth * 0.5, y: faceY + faceHeight * 0.75 },
      });
    };
    img.onerror = () => resolve(null);
    img.src = imageData;
  });
};

/**
 * Draw cat ears on the canvas
 */
const drawCatEars = (
  ctx: CanvasRenderingContext2D,
  face: FaceDetectionResult,
  config: CatFilterConfig
) => {
  if (config.earsColor === 'transparent') return;

  const earSize = face.width * 0.25;
  const earHeight = earSize * 1.3;

  // Left ear
  const leftEarX = face.x + face.width * 0.15;
  const leftEarY = face.y - earHeight * 0.3;

  // Right ear
  const rightEarX = face.x + face.width * 0.85;
  const rightEarY = face.y - earHeight * 0.3;

  // Glow effect for special filters
  if (config.glowColor) {
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 20;
  }

  ctx.fillStyle = config.earsColor;
  ctx.strokeStyle = config.id === 'cyberpunk' ? '#000000' : config.earsColor;
  ctx.lineWidth = 3;

  // Draw left ear (triangle)
  ctx.beginPath();
  ctx.moveTo(leftEarX, leftEarY + earHeight);
  ctx.lineTo(leftEarX + earSize / 2, leftEarY);
  ctx.lineTo(leftEarX + earSize, leftEarY + earHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner ear
  ctx.fillStyle = config.id === 'anime' ? '#FFDDDD' : '#FFCCCC';
  ctx.beginPath();
  ctx.moveTo(leftEarX + earSize * 0.2, leftEarY + earHeight * 0.7);
  ctx.lineTo(leftEarX + earSize / 2, leftEarY + earHeight * 0.2);
  ctx.lineTo(leftEarX + earSize * 0.8, leftEarY + earHeight * 0.7);
  ctx.closePath();
  ctx.fill();

  // Draw right ear (triangle)
  ctx.fillStyle = config.earsColor;
  ctx.beginPath();
  ctx.moveTo(rightEarX - earSize, rightEarY + earHeight);
  ctx.lineTo(rightEarX - earSize / 2, rightEarY);
  ctx.lineTo(rightEarX, rightEarY + earHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner ear
  ctx.fillStyle = config.id === 'anime' ? '#FFDDDD' : '#FFCCCC';
  ctx.beginPath();
  ctx.moveTo(rightEarX - earSize * 0.8, rightEarY + earHeight * 0.7);
  ctx.lineTo(rightEarX - earSize / 2, rightEarY + earHeight * 0.2);
  ctx.lineTo(rightEarX - earSize * 0.2, rightEarY + earHeight * 0.7);
  ctx.closePath();
  ctx.fill();

  // Reset shadow
  ctx.shadowBlur = 0;
};

/**
 * Draw cat nose on the canvas
 */
const drawCatNose = (
  ctx: CanvasRenderingContext2D,
  face: FaceDetectionResult,
  config: CatFilterConfig
) => {
  if (config.noseColor === 'transparent') return;

  const noseX = face.nose?.x || face.x + face.width / 2;
  const noseY = face.nose?.y || face.y + face.height * 0.55;
  const noseSize = face.width * 0.08;

  if (config.glowColor) {
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 10;
  }

  // Draw nose (upside-down triangle)
  ctx.fillStyle = config.noseColor;
  ctx.beginPath();
  ctx.moveTo(noseX, noseY + noseSize);
  ctx.lineTo(noseX - noseSize, noseY);
  ctx.lineTo(noseX + noseSize, noseY);
  ctx.closePath();
  ctx.fill();

  // Nose highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(noseX - noseSize * 0.3, noseY + noseSize * 0.3, noseSize * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
};

/**
 * Draw cat whiskers on the canvas
 */
const drawWhiskers = (
  ctx: CanvasRenderingContext2D,
  face: FaceDetectionResult,
  config: CatFilterConfig
) => {
  if (config.whiskersColor === 'transparent') return;

  const noseX = face.nose?.x || face.x + face.width / 2;
  const noseY = face.nose?.y || face.y + face.height * 0.55;
  const whiskerLength = face.width * 0.35;
  const whiskerSpacing = face.height * 0.04;

  if (config.glowColor) {
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 5;
  }

  ctx.strokeStyle = config.whiskersColor;
  ctx.lineWidth = config.id === 'cyberpunk' ? 3 : 2;
  ctx.lineCap = 'round';

  // Left whiskers
  for (let i = -1; i <= 1; i++) {
    const startY = noseY + whiskerSpacing * i;
    const endY = startY + whiskerSpacing * i * 0.5;

    ctx.beginPath();
    ctx.moveTo(noseX - face.width * 0.1, startY);
    ctx.quadraticCurveTo(
      noseX - whiskerLength * 0.5,
      startY,
      noseX - whiskerLength,
      endY - whiskerSpacing
    );
    ctx.stroke();
  }

  // Right whiskers
  for (let i = -1; i <= 1; i++) {
    const startY = noseY + whiskerSpacing * i;
    const endY = startY + whiskerSpacing * i * 0.5;

    ctx.beginPath();
    ctx.moveTo(noseX + face.width * 0.1, startY);
    ctx.quadraticCurveTo(
      noseX + whiskerLength * 0.5,
      startY,
      noseX + whiskerLength,
      endY - whiskerSpacing
    );
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
};

/**
 * Apply cat filter to an image
 * Returns a new data URL with the filter applied
 */
export const applyCatFilter = async (
  imageDataUrl: string,
  filterType: CatFilterType
): Promise<string> => {
  if (filterType === 'none') {
    return imageDataUrl;
  }

  const config = CAT_FILTERS.find((f) => f.id === filterType);
  if (!config) {
    return imageDataUrl;
  }

  const face = await detectFaceSimple(imageDataUrl);
  if (!face) {
    return imageDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Apply cat filter elements
      drawCatEars(ctx, face, config);
      drawCatNose(ctx, face, config);
      drawWhiskers(ctx, face, config);

      // Convert back to data URL
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
};

/**
 * Get filter config by ID
 */
export const getFilterConfig = (filterType: CatFilterType): CatFilterConfig | undefined => {
  return CAT_FILTERS.find((f) => f.id === filterType);
};

/**
 * Generate a preview of all filters for a given image
 */
export const generateFilterPreviews = async (
  imageDataUrl: string
): Promise<Map<CatFilterType, string>> => {
  const previews = new Map<CatFilterType, string>();

  for (const filter of CAT_FILTERS) {
    const filteredImage = await applyCatFilter(imageDataUrl, filter.id);
    previews.set(filter.id, filteredImage);
  }

  return previews;
};
