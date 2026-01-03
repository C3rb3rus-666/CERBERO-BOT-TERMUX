import sys
import json
import tensorflow as tf
import numpy as np
import os

MODEL_PATH = "model_termux"

# Si ya hay modelo, cargarlo
if os.path.exists(MODEL_PATH):
    model = tf.keras.models.load_model(MODEL_PATH)
else:
    # Modelo inicial muy básico
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(1, input_shape=(1,), activation="sigmoid")
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy")

# Recibir entrada
count = int(sys.argv[1])

# Predicción
x = np.array([[count]])
risk = float(model.predict(x, verbose=0)[0][0])

# Entrenamiento rápido para ir mejorando
y = np.array([[1 if count > 4 else 0]])
model.fit(x, y, epochs=1, verbose=0)

# Guardar modelo
model.save(MODEL_PATH)

# Devolver resultado
print(json.dumps({"risk": risk}))
