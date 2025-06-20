interface WorkerMessage {
  type: 'init' | 'frame';
  canvas?: OffscreenCanvas;
  imageData?: ImageData;
  timestamp?: number;
}

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, canvas: receivedCanvas, imageData, timestamp } = event.data;

  switch (type) {
    case 'init':
      if (receivedCanvas) {
        canvas = receivedCanvas;
        ctx = canvas.getContext('2d');
        console.log('Worker initialized with OffscreenCanvas');
      }
      break;

    case 'frame':
      if (imageData && timestamp) {
        console.log(`Frame received in worker at timestamp: ${timestamp}`);
        
        console.log(`Frame dimensions: ${imageData.width}x${imageData.height}`);
        
        if (ctx && canvas) {
          ctx.putImageData(imageData, 0, 0);
          console.log('Frame drawn to OffscreenCanvas');
        }
      }
      break;

    default:
      console.warn('Unknown message type:', type);
  }
};

// Send ready message when worker is loaded
self.postMessage({ type: 'ready' });