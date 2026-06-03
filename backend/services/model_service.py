import base64
import io
import numpy as np
import tensorflow as tf
from PIL import Image
from typing import List, Optional, Dict
import mediapipe as mp
from mediapipe.python.solutions import face_mesh as mp_face_mesh

class ModelService:
    def __init__(self, model_path: str):
        """Initializes the ModelService with a TensorFlow/TFLite model and MediaPipe.

        Args:
            model_path (str): The absolute path to the .tflite or .keras model file.
        """
        # Initialize ML Model
        if not model_path.endswith('.tflite'):
            self.model = tf.keras.models.load_model(model_path)
            self.is_tflite = False
            self.input_shape = self.model.input_shape
        else:
            self.interpreter = tf.lite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            self.input_shape = self.input_details[0]['shape']
            self.is_tflite = True

        # Initialize MediaPipe Face Mesh
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True, 
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

        # Landmark Indices
        self.LEFT_EYE = [362, 385, 387, 263, 373, 380]
        self.RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        self.MOUTH = [13, 14, 78, 308] # Vertical (13,14), Horizontal (78,308)

    def calculate_ear(self, landmarks, eye_indices):
        """Calculates Eye Aspect Ratio (EAR)."""
        coords = [landmarks[idx] for idx in eye_indices]
        # Distances: p2-p6, p3-p5
        v1 = np.linalg.norm(np.array([coords[1].x, coords[1].y]) - np.array([coords[5].x, coords[5].y]))
        v2 = np.linalg.norm(np.array([coords[2].x, coords[2].y]) - np.array([coords[4].x, coords[4].y]))
        # Horizontal: p1-p4
        h = np.linalg.norm(np.array([coords[0].x, coords[0].y]) - np.array([coords[3].x, coords[3].y]))
        return (v1 + v2) / (2.0 * h) if h > 0 else 0

    def calculate_mar(self, landmarks):
        """Calculates Mouth Aspect Ratio (MAR)."""
        coords = [landmarks[idx] for idx in self.MOUTH]
        v = np.linalg.norm(np.array([coords[0].x, coords[0].y]) - np.array([coords[1].x, coords[1].y]))
        h = np.linalg.norm(np.array([coords[2].x, coords[2].y]) - np.array([coords[3].x, coords[3].y]))
        return v / h if h > 0 else 0

    def preprocess_frame(self, base64_frame: str) -> tuple[np.ndarray, np.ndarray, Optional[Dict]] | tuple[None, None, None]:
        """Decodes base64 string and prepares both ML tensor and raw image for MediaPipe."""
        try:
            if "," in base64_frame:
                base64_frame = base64_frame.split(",")[1]
            
            img_data = base64.b64decode(base64_frame)
            img = Image.open(io.BytesIO(img_data)).convert('RGB')
            raw_array = np.array(img)
            
            # Default: No crop info
            crop_info = None

            # 1. First, detect face with MediaPipe to get Bounding Box
            mp_results = self.face_mesh.process(raw_array)
            multi_face_landmarks = getattr(mp_results, 'multi_face_landmarks', None)
            
            if multi_face_landmarks:
                landmarks = multi_face_landmarks[0].landmark
                # Calculate Bounding Box
                xs = [lm.x for lm in landmarks]
                ys = [lm.y for lm in landmarks]
                w, h = img.size
                
                # Add margin (20%)
                margin = 0.2
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                
                bw, bh = x_max - x_min, y_max - y_min
                left   = max(0, x_min - bw * margin) * w
                top    = max(0, y_min - bh * margin) * h
                right  = min(1, x_max + bw * margin) * w
                bottom = min(1, y_max + bh * margin) * h
                
                # Crop and Resize
                img_face = img.crop((left, top, right, bottom))
                target_size = (self.input_shape[1], self.input_shape[2])
                img_resized = img_face.resize(target_size)
                
                crop_info = {
                    "landmarks": landmarks,
                    "box": [left, top, right, bottom]
                }
            else:
                # Fallback: No face detected, use whole image (less accurate for CNN)
                target_size = (self.input_shape[1], self.input_shape[2])
                img_resized = img.resize(target_size)
            
            # ML Tensor Preprocessing (MobileNetV2 expects [-1, 1])
            img_array = np.array(img_resized).astype(np.float32)
            img_array = (img_array / 127.5) - 1.0 
            
            return np.expand_dims(img_array, axis=0), raw_array, crop_info
        except Exception as e:
            print(f"Preprocessing error: {e}")
            return None, None, None

    def predict(self, frames: List[str], config: Optional[Dict] = None) -> Dict:
        """Performs batch hybrid inference (ML + MediaPipe)."""
        scores = []
        ear_values = []
        mar_values = []
        face_detected_count = 0
        total_frames = len(frames)
        last_landmarks = None
        last_values = None
        
        # Default config
        config = config or {}
        use_cnn = config.get("use_cnn", True)
        use_mp = config.get("use_mediapipe", True)
        
        for frame_b64 in frames:
            input_data, raw_image, crop_info = self.preprocess_frame(frame_b64)
            if input_data is None or raw_image is None:
                continue

            # 1. MediaPipe Geometry (Reuse landmarks from preprocessing if available)
            landmarks = crop_info.get("landmarks") if crop_info else None
            
            if landmarks:
                ear_l = self.calculate_ear(landmarks, self.LEFT_EYE)
                ear_r = self.calculate_ear(landmarks, self.RIGHT_EYE)
                avg_ear = (ear_l + ear_r) / 2.0
                avg_mar = self.calculate_mar(landmarks)
                
                ear_values.append(avg_ear)
                mar_values.append(avg_mar)
                face_detected_count += 1

                # Store last landmarks and values for realtime visualization
                last_landmarks = landmarks
                last_values = {"ear": avg_ear, "mar": avg_mar}
            else:
                last_landmarks = None
                last_values = None
                # If no face detected by MediaPipe, skip this frame to maintain accuracy
                if not use_cnn: continue 

            # 2. CNN Inference
            if use_cnn:
                # input_data is guaranteed not None here due to check above
                if self.is_tflite:
                    self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
                    self.interpreter.invoke()
                    prediction = self.interpreter.get_tensor(self.output_details[0]['index'])
                    # Apply sigmoid to convert logit to probability (0-1)
                    raw_score = float(prediction[0][0])
                    score = 1 / (1 + np.exp(-raw_score))
                else:
                    prediction = self.model.predict(input_data, verbose=0)
                    raw_score = float(prediction[0][0])
                    score = 1 / (1 + np.exp(-raw_score))
                scores.append(score)
            
        if not scores and not ear_values:
            return {
                "fatigue_score": 0.0,
                "ear_avg": 0.0,
                "mar_avg": 0.0,
                "yawn_count": 0,
                "face_detected_count": 0,
                "total_frames": total_frames,
                "status": "error",
                "message": "No faces detected in frames"
            }

        avg_fatigue = float(np.mean(scores)) if scores else 0.0
        # Clip score between 0 and 1
        avg_fatigue = max(0.0, min(1.0, avg_fatigue))
        
        avg_ear = float(np.mean(ear_values)) if ear_values else 0.0
        avg_mar = float(np.mean(mar_values)) if mar_values else 0.0
        
        # Yawn detection logic: count frames where MAR is significantly high
        # Changed from boolean to integer count for better granularity
        yawn_frames = [m for m in mar_values if m > 0.35]
        yawn_count = len(yawn_frames)

        result = {
            "fatigue_score": avg_fatigue,
            "ear_avg": avg_ear,
            "mar_avg": avg_mar,
            "yawn_count": yawn_count,
            "face_detected_count": face_detected_count,
            "total_frames": total_frames,
            "status": "success"
        }

        # Add landmarks for debugging/realtime if only 1 frame was processed
        if total_frames == 1 and use_mp and last_landmarks:
            # Only send key landmarks to save bandwidth
            # Eye indices (approximate from FaceMesh)
            result["landmarks"] = [
                {"x": l.x, "y": l.y} for l in last_landmarks
            ]

        return result

