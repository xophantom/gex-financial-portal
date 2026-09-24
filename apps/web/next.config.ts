import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A imagem Docker roda `node apps/web/server.js` a partir do build
  // standalone do Next. Sem apontar explicitamente a raiz do monorepo, o
  // rastreador de arquivos infere o root a partir do lockfile mais próximo
  // e pode não incluir `@gex/shared` (fora de apps/web) no pacote final.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
