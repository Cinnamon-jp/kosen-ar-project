import { defineConfig, type PluginOption } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// 本番（GitHub Pages）ではサブパス /kosen-ar-project/ 配下に配置されるため base を切替
export default defineConfig(({ command, mode }) => {
    const plugins: PluginOption[] = [];

    if (command === 'serve') {
        plugins.push(
            mkcert({
                hosts: ['localhost', '172.21.208.1', '192.168.0.24']
            })
        );
    }

    return {
        base: mode === 'production' ? '/kosen-ar-project/' : '/',
        plugins,
        server: {
            https: {},       // mkcertの信頼済み証明書でHTTPS
            host: '0.0.0.0', // 0.0.0.0で待受（スマホ実機からアクセス可）
            port: 5173
        },
        preview: {
            https: {}
        }
    };
});