import {useState, useRef, useEffect} from 'react'

function App() {
  const [cameraPermission, setCameraPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [isStreaming, setIsStreaming] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    
    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'ready') {
        console.log('Worker is ready')
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const requestCameraAccess = async () => {
    setCameraPermission('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: true})
      streamRef.current = stream
      setCameraPermission('granted')
      
      // Show streaming UI first, then start video processing
      setIsStreaming(true)
      
      // Start video processing after UI update
      setTimeout(() => {
        startVideoStream(stream)
      }, 100)
    } catch (error) {
      console.error('Camera access denied:', error)
      setCameraPermission('denied')
    }
  }

  const startVideoStream = async (stream: MediaStream) => {
    if (!workerRef.current) {
      console.error('Refs not initialized')
      return
    }

    // Wait for refs to be available
    await new Promise<void>((resolve) => {
      const checkRefs = () => {
        if (videoRef.current && canvasRef.current && workerRef.current) {
          resolve()
        } else {
          setTimeout(checkRefs, 10)
        }
      }
      checkRefs()
    })

    const video = videoRef.current!
    const canvas = canvasRef.current!

    video.srcObject = stream
    await video.play()

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    console.log(`Canvas dimensions set to: ${canvas.width}x${canvas.height}`)

    // Create OffscreenCanvas for worker BEFORE getting context
    const offscreenCanvas = canvas.transferControlToOffscreen()
    
    // Send OffscreenCanvas to worker
    workerRef.current.postMessage({
      type: 'init',
      canvas: offscreenCanvas
    }, [offscreenCanvas])

    console.log('OffscreenCanvas sent to worker')

    // Create a separate canvas for main thread processing
    const mainCanvas = document.createElement('canvas')
    mainCanvas.width = canvas.width
    mainCanvas.height = canvas.height
    const ctx = mainCanvas.getContext('2d')
    
    if (!ctx) {
      console.error('Failed to get canvas context')
      return
    }
    
    // Start frame processing
    const processFrame = () => {
      if (!video || !ctx) return

      // Draw video frame to main canvas for processing
      ctx.drawImage(video, 0, 0, mainCanvas.width, mainCanvas.height)
      
      // Get image data and send to worker
      const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height)
      
      workerRef.current?.postMessage({
        type: 'frame',
        imageData,
        timestamp: Date.now()
      })

      animationRef.current = requestAnimationFrame(processFrame)
    }

    processFrame()
  }

  return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        {!isStreaming ? (
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Camera Access
                </h1>
                <p className="text-gray-600">
                  Please allow camera access to use this feature. Click the button below to request access.
                </p>
              </div>

              <div className="mb-6">
                <div className="w-fit mx-auto">
                  {cameraPermission === 'idle' && (
                      <button
                          onClick={requestCameraAccess}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        カメラを開始
                      </button>
                  )}

                  {cameraPermission === 'requesting' && (
                      <div
                          className="w-full bg-gray-100 text-gray-600 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                        <div
                            className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
                        カメラアクセスを要求中...
                      </div>
                  )}

                  {cameraPermission === 'granted' && !isStreaming && (
                      <div
                          className="w-full bg-green-100 text-green-800 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                        カメラアクセス許可済み - 初期化中...
                      </div>
                  )}

                  {cameraPermission === 'denied' && (
                      <div className="space-y-3">
                        <div
                            className="w-full bg-red-100 text-red-800 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                          カメラアクセスが拒否されました
                        </div>
                        <button
                            onClick={requestCameraAccess}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                        >
                          再試行
                        </button>
                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Offline Canvas  POC
                </h1>
              </div>
              
              <div className="flex justify-center space-x-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Camera Feed</h3>
                  <video
                    ref={videoRef}
                    className="w-80 h-60 bg-gray-200 rounded border"
                    muted
                    playsInline
                  />
                </div>
                
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Canvas Output</h3>
                  <canvas
                    ref={canvasRef}
                    className="w-80 h-60 bg-gray-200 rounded border"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}

export default App
