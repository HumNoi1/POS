<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['scan', 'close']);

const videoRef = ref(null);
const codeReader = new BrowserMultiFormatReader();
const isScanning = ref(false);
const errorMessage = ref('');
const cameras = ref([]);
const selectedCamera = ref('');

// Capabilities
const hasFlash = ref(false);
const isFlashOn = ref(false);
const zoomCapability = ref(null); // { min, max, step }
const zoomValue = ref(1);

const startScanner = async () => {
  if (!selectedCamera.value) {
    errorMessage.value = 'กรุณาเลือกกล้อง';
    return;
  }

  try {
    errorMessage.value = '';
    isScanning.value = true;
    
    // Reset capabilities
    hasFlash.value = false;
    isFlashOn.value = false;
    zoomCapability.value = null;
    zoomValue.value = 1;

    // Start decoding
    await codeReader.decodeFromVideoDevice(
      selectedCamera.value,
      videoRef.value,
      (result, err) => {
        if (result) {
          console.log('Scanned:', result.getText());
          emit('scan', result.getText());
          stopScanner();
        }
        if (err && !(err instanceof NotFoundException)) {
          // Real error
          // console.error(err); 
        }
      }
    );

    // Check capabilities after stream is active
    await nextTick();
    checkCapabilities();

  } catch (err) {
    console.error('Scanner start error:', err);
    errorMessage.value = 'ไม่สามารถเปิดกล้องได้: ' + err.message;
    isScanning.value = false;
  }
};

const checkCapabilities = () => {
  const videoEl = videoRef.value;
  if (!videoEl || !videoEl.srcObject) return;

  const track = videoEl.srcObject.getVideoTracks()[0];
  if (!track) return;

  const capabilities = track.getCapabilities();
  const settings = track.getSettings();

  // Check Zoom
  if (capabilities.zoom) {
    zoomCapability.value = {
      min: capabilities.zoom.min,
      max: capabilities.zoom.max,
      step: capabilities.zoom.step
    };
    zoomValue.value = settings.zoom || capabilities.zoom.min;
  }

  // Check Torch
  if (capabilities.torch) {
    hasFlash.value = true;
  }
};

const toggleFlash = async () => {
  const videoEl = videoRef.value;
  if (!videoEl || !videoEl.srcObject) return;

  const track = videoEl.srcObject.getVideoTracks()[0];
  if (!track) return;

  try {
    isFlashOn.value = !isFlashOn.value;
    await track.applyConstraints({
      advanced: [{ torch: isFlashOn.value }]
    });
  } catch (err) {
    console.error('Toggle flash error:', err);
    isFlashOn.value = !isFlashOn.value; // Revert
  }
};

const handleZoom = async () => {
  const videoEl = videoRef.value;
  if (!videoEl || !videoEl.srcObject) return;

  const track = videoEl.srcObject.getVideoTracks()[0];
  if (!track) return;

  try {
    await track.applyConstraints({
      advanced: [{ zoom: parseFloat(zoomValue.value) }]
    });
  } catch (err) {
    console.error('Zoom error:', err);
  }
};

const stopScanner = () => {
  codeReader.reset();
  isScanning.value = false;
  
  // Also stop the stream tracks manually if needed (ZXing reset usually does this)
  if (videoRef.value && videoRef.value.srcObject) {
     const tracks = videoRef.value.srcObject.getTracks();
     tracks.forEach(track => track.stop());
     videoRef.value.srcObject = null;
  }
};

const handleClose = () => {
  stopScanner();
  emit('close');
};

const getCameras = async () => {
  try {
    const devices = await codeReader.listVideoInputDevices();
    cameras.value = devices;
    if (devices.length > 0) {
      // Try to find back camera
      const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
      selectedCamera.value = backCamera ? backCamera.deviceId : devices[0].deviceId;
    }
  } catch (err) {
    console.error('Get cameras error:', err);
    errorMessage.value = 'ไม่สามารถเข้าถึงกล้องได้ - กรุณาอนุญาตการใช้งานกล้อง';
  }
};

watch(() => props.show, async (newVal) => {
  if (newVal) {
    await getCameras();
    // Auto start if cameras found
    if (cameras.value.length > 0 && selectedCamera.value) {
       // Short delay to ensuring modal transition
       setTimeout(() => startScanner(), 300);
    }
  } else {
    stopScanner();
  }
});

onUnmounted(() => {
  stopScanner();
});
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="scanner-overlay" @click.self="handleClose">
      <div class="scanner-modal">
        <div class="scanner-header">
          <h3>📷 สแกนบาร์โค้ด (ZXing)</h3>
          <button class="close-btn" @click="handleClose">✕</button>
        </div>

        <div class="scanner-body">
          <!-- Camera selector -->
          <div class="camera-selector" v-if="cameras.length > 1">
            <label>เลือกกล้อง:</label>
            <select v-model="selectedCamera" @change="() => { stopScanner(); startScanner(); }">
              <option v-for="cam in cameras" :key="cam.deviceId" :value="cam.deviceId">
                {{ cam.label || `Camera ${cam.deviceId}` }}
              </option>
            </select>
          </div>

          <!-- Scanner region -->
          <div class="scanner-wrapper">
             <video ref="videoRef" class="scanner-video" autoplay muted playsinline></video>
            
            <!-- Controls Overlay -->
            <div class="scanner-controls-overlay" v-if="isScanning">
               <!-- Flash Toggle -->
               <button 
                  v-if="hasFlash"
                  class="control-btn flash-btn" 
                  :class="{ active: isFlashOn }"
                  @click="toggleFlash"
                  title="เปิด/ปิด ไฟฉาย"
               >
                  {{ isFlashOn ? '🔦 On' : '🔦 Off' }}
               </button>

               <!-- Zoom Slider -->
               <div v-if="zoomCapability" class="zoom-control">
                  <span class="zoom-icon">➖</span>
                  <input 
                    type="range" 
                    v-model="zoomValue" 
                    :min="zoomCapability.min" 
                    :max="zoomCapability.max" 
                    :step="zoomCapability.step"
                    @input="handleZoom"
                    class="zoom-slider"
                  >
                  <span class="zoom-icon">➕</span>
                  <div class="zoom-value">{{ parseFloat(zoomValue).toFixed(1) }}x</div>
               </div>
            </div>
            
            <!-- Scanning Guide Overlay -->
             <div class="scan-guide" v-if="isScanning"></div>
          </div>

          <!-- Error message -->
          <div v-if="errorMessage" class="scanner-error">
            ❌ {{ errorMessage }}
          </div>

          <!-- Instructions -->
          <div class="scanner-instructions">
            <p v-if="!isScanning">กำลังเริ่มกล้อง...</p>
            <p v-else>📍 ส่องบาร์โค้ดให้อยู่ในกรอบกลางจอ</p>
          </div>
        </div>

        <div class="scanner-actions">
           <button class="btn btn-secondary" @click="handleClose">ปิด</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scanner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.scanner-modal {
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border-radius: 16px;
  width: 95%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.scanner-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  color: #ff6b6b;
}

.scanner-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.camera-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.camera-selector label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.camera-selector select {
  flex: 1;
  padding: 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.9rem;
}

.camera-selector select option {
  background: #1a1a3e;
  color: #fff;
}

.scanner-wrapper {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  min-height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scan-guide {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 30%;
  border: 2px solid rgba(0, 212, 255, 0.8);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.scanner-controls-overlay {
  position: absolute;
  bottom: 20px;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  z-index: 10;
  padding: 0 20px;
  box-sizing: border-box;
}

.control-btn {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}

.control-btn.active {
  background: rgba(255, 193, 7, 0.2);
  border-color: #ffc107;
  color: #ffc107;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 25px;
  backdrop-filter: blur(4px);
  width: 80%;
  max-width: 300px;
}

.zoom-slider {
  flex: 1;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.2);
  height: 4px;
  border-radius: 2px;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.zoom-icon {
  color: #fff;
  font-size: 0.8rem;
}

.zoom-value {
  color: #fff;
  font-size: 0.8rem;
  min-width: 30px;
  text-align: right;
}

.scanner-error {
  margin-top: 1rem;
  padding: 0.8rem;
  background: rgba(255, 107, 107, 0.2);
  border-radius: 8px;
  color: #ff6b6b;
  text-align: center;
}

.scanner-instructions {
  text-align: center;
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.7);
}

.scanner-instructions p {
  margin: 0;
}

.scanner-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Animations */
.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-from .scanner-modal, .modal-leave-to .scanner-modal {
  transform: scale(0.9);
}
</style>
