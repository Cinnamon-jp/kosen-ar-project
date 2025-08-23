import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
plugins: [
    mkcert({
        hosts: [
            "localhost",
            "172.21.208.1",
            "192.168.0.24"
        ]
    })
],
server: {
    https: {},   // mkcertの信頼済み証明書でHTTPS
    host: "0.0.0.0",    // 0.0.0.0で待受（スマホ実機からアクセス可）
    port: 5173,
    // proxy: {
    //     "/models": {
    //         target: "http://localhost:3000",
    //         changeOrigin: true,
    //     }
    // }
},
preview: {
    https: {}
}
});