# ml-model

On-device machine learning module for AgroScanner. **In development.**

## Goal

Classify crop leaf images captured in the field into:

| Class | Crop |
|---|---|
| HLB (citrus greening) | Lemon |
| Black Sigatoka | Banana |
| Red spider mite | Papaya |
| Healthy | Any |

## Planned approach

- MobileNetV3-Small with transfer learning.
- Dataset: public references (e.g. PlantVillage) + field images collected in Colima.
- Export to TensorFlow Lite for on-device inference.
- Integration with the app's capture flow, replacing the current simulated result
  (`getResultadoSimulado()` in `CamaraScreen.tsx`).

## Metrics to report

- Accuracy and macro F1 per class.
- Confusion matrix and failure cases.
- Model size (MB) and inference latency (ms) on a mid-range Android device.

## Status

Not started. The mobile app currently returns simulated results for the full
capture-to-history flow.
