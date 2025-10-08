import { defineConfig, type PluginOption } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// 本番（GitHub Pages）ではサブパス /kosen-ar-project/ 配下に配置されるため base を切替
export default defineConfig(({ command, mode }) => {
    const plugins: PluginOption[] = [];

    if (command === 'serve') {
        plugins.push(
            mkcert({
                hosts: ['localhost']
            })
        );
    }

    return {
        base: mode === 'production' ? '/kosen-ar-project/' : '/',
        plugins,
        server: {
            https: {},          // mkcertの信頼済み証明書でHTTPS
            host: 'localhost',  // ローカルホストのみ待受
            port: 5173
        },
        preview: {
            https: {}
        }
    };
});