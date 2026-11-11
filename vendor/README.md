# Self-hosted import dependencies

All OCR dependencies and models are loaded from this folder; uploaded images are not sent to an OCR service.

- `ocr/tesseract.min.js`, `ocr/worker.min.js`: tesseract.js 6.0.1, Apache-2.0. npm: https://www.npmjs.com/package/tesseract.js/v/6.0.1
- `ocr/core/`: tesseract.js-core 6.0.0, Apache-2.0. Both SIMD and non-SIMD LSTM builds are included for browser compatibility.
- `ocr/lang/chi_tra.traineddata.gz`: @tesseract.js-data/chi_tra 1.0.0, `4.0.0_best_int`. https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_tra@1.0.0/4.0.0_best_int/chi_tra.traineddata.gz
- `ocr/lang/eng.traineddata.gz`: @tesseract.js-data/eng 1.0.0, `4.0.0_best_int`. https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz
- `pinyin/pinyin-pro.js`: pinyin-pro 3.27.0, MIT. Suggestions only; imported Pinyin remains editable.
- `pinyin/opencc.js`: opencc-js 1.0.5, MIT. Traditional-to-Simplified conversion is used for Pinyin suggestions and the global character display setting. The stored Chinese text remains unchanged.

Upstream license files are retained beside each library. Language models originate from the Tesseract tessdata project (Apache-2.0): https://github.com/tesseract-ocr/tessdata.
