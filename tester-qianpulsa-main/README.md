# QianPulsa Auto Tester

Tester otomatis untuk QianPulsa Core API.

## Fitur
1. **Multi-Role Auth**: Mendukung Admin, Seller, dan Store.
2. **Token Persistence**: Menyimpan token di `tokens.json` agar tidak perlu login ulang.
3. **Auto Execution**: Menjalankan endpoint secara berulang dengan delay yang ditentukan.
4. **Smart Logging**: Menyimpan response berdasarkan status code. Jika status code sama, file akan ditimpa (latest). Jika berbeda, akan disimpan sebagai file baru (misal: `200.json`, `401.json`).

## Persiapan
1. Pastikan Node.js sudah terinstal.
2. Edit `config.json`:
   - `baseUrl`: URL API (default: https://qianpulsa-coreapi-v1.onrender.com).
   - `delay`: Jeda waktu antar request (ms).
   - `clientKey`: Isi dengan `CLIENT_SECRET_KEY` dari .env API kamu.
   - `roles`: Isi credential (`email`/`phone` & `password`) untuk masing-masing peran.
   - `endpoints`: Tambahkan path dan data yang ingin di-test.

## Cara Menjalankan
```bash
node tester.js
```

## Struktur Output
Response akan disimpan di folder `responses/`:
`responses/<role>/<endpoint_name>/<status_code>.json`

Contoh:
`responses/admin/_api_v1_admin_auth_me/200.json`
