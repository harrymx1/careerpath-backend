import sys
import json
import os
import joblib
import numpy as np

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import tensorflow as tf

def predict(input_data):
    try:
        # Load model and scaler
        base_dir = os.path.dirname(os.path.abspath(__file__))
        scaler = joblib.load(os.path.join(base_dir, 'scaler.pkl'))
        label_encoder = joblib.load(os.path.join(base_dir, 'label_encoder.pkl'))
        model = tf.keras.models.load_model(os.path.join(base_dir, 'best_model.keras'))
        
        with open(os.path.join(base_dir, 'model_config.json'), 'r') as f:
            config = json.load(f)

        # Preprocess input
        features = np.array([input_data]).reshape(1, -1)
        scaled_features = scaler.transform(features)

        # Predict
        probabilities = model.predict(scaled_features, verbose=0)[0]
        
        # Get top 3 indices
        top_3_idx = probabilities.argsort()[-3:][::-1]
        
        results = []
        rank = 1
        for idx in top_3_idx:
            # inverse transform to get class name, but we can also use config['career_labels']
            career_name = config['career_labels'][idx]
            prob = float(probabilities[idx]) * 100
            
            # Simple dummy skill gap calculation based on current vs max(5)
            skill_gap = {}
            for i, q in enumerate(config['feature_columns']):
                if input_data[i] < 4:
                    skill_gap[q] = {"current": int(input_data[i]), "required": 4}
            
            results.append({
                "career_encoded": int(idx),
                "career_name": career_name,
                "rank": rank,
                "readiness_percentage": round(prob, 2),
                "skill_gap": skill_gap
            })
            rank += 1
            
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # input is a comma separated list of 10 integers
        input_str = sys.argv[1]
        input_data = [int(x) for x in input_str.split(',')]
        if len(input_data) == 10:
            res = predict(input_data)
            print(json.dumps(res))
        else:
            print(json.dumps({"status": "error", "message": "Expected 10 features"}))
    else:
        print(json.dumps({"status": "error", "message": "No input provided"}))
