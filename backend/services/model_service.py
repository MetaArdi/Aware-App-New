import base64
import io
import numpy as np
import tensorflow as tf
from PIL import Image
from typing import List

class ModelService:
    def __init__(self, model_path: str):
        """Initializes the ModelService with a TensorFlow or TFLite model.

        Args:
            model_path (str): The absolute path to the .tflite or .keras model file.
        """
        if not model_path.endswith('.tflite'):
            # Fallback for .keras if needed, but TFLite is preferred for inference
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

    def preprocess_frame(self, base64_frame: str) -> np.ndarray | None:
        """Decodes base64 string to image, resizes, and normalizes it.

        Args:
            base64_frame (str): Image frame encoded in base64 format (with or without data URI header).

        Returns:
            np.ndarray: Preprocessed image tensor of shape (1, height, width, 3), 
                       or None if preprocessing fails.
        """
        try:
            # Handle data URI header if present
            if "," in base64_frame:
                base64_frame = base64_frame.split(",")[1]
            
            img_data = base64.b64decode(base64_frame)
            img = Image.open(io.BytesIO(img_data)).convert('RGB')
            
            # Use input shape from model (usually 224x224)
            target_size = (self.input_shape[1], self.input_shape[2])
            img = img.resize(target_size)
            
            # Normalize to [0, 1] range as expected by the MobileNetV2 architecture
            img_array = np.array(img).astype(np.float32) / 255.0
            return np.expand_dims(img_array, axis=0)
        except Exception as e:
            # In production, use structured logging
            print(f"Preprocessing error: {e}")
            return None

    def predict(self, frames: List[str]) -> dict:
        """Performs batch inference on a list of image frames.

        Args:
            frames (List[str]): A list of base64 encoded image strings.

        Returns:
            dict: A dictionary containing averaged fatigue score, placeholders for EAR/MAR, 
                  yawn detection status, and processing metadata.
        """
        scores = []
        face_detected_count = 0
        total_frames = len(frames)
        
        for frame_b64 in frames:
            input_data = self.preprocess_frame(frame_b64)
            if input_data is None:
                continue
                
            if self.is_tflite:
                # Set input tensor and invoke interpreter for TFLite
                self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
                self.interpreter.invoke()
                prediction = self.interpreter.get_tensor(self.output_details[0]['index'])
                score = float(prediction[0][0])
            else:
                # Standard Keras prediction
                prediction = self.model.predict(input_data, verbose=0)
                score = float(prediction[0][0])
            
            scores.append(score)
            face_detected_count += 1
            
        if not scores:
            return {
                "fatigue_score": 0.0,
                "ear_avg": 0.0,
                "mar_avg": 0.0,
                "yawn_detected": False,
                "face_detected_count": 0,
                "total_frames": total_frames,
                "status": "error",
                "message": "No valid frames detected"
            }
            
        avg_fatigue = sum(scores) / len(scores)
        
        # EAR and MAR are placeholders as the current model is a flat fatigue classifier.
        # Future improvement: integrate landmark detection for real EAR/MAR calculation.
        return {
            "fatigue_score": round(avg_fatigue, 4),
            "ear_avg": 0.35,  # Placeholder/Baseline
            "mar_avg": 0.15,  # Placeholder/Baseline
            "yawn_detected": avg_fatigue > 0.65, # Simple threshold-based detection
            "face_detected_count": face_detected_count,
            "total_frames": total_frames,
            "status": "success"
        }
