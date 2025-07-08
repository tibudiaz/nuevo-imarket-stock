/**
 * @type {import('next').NextConfig}
 */

// Configuración de Next.js para iMarket
const nextConfig = {
  // Habilitar modo estricto de React para detectar problemas potenciales
  reactStrictMode: true,
  
  // Configuración para exportación estática
  // Esto permite generar archivos HTML estáticos que pueden ser alojados en cualquier servidor
  output: 'export',
  
  // Deshabilitar la generación de etags para archivos estáticos
  // Útil para mejorar el rendimiento en algunos casos
  generateEtags: false,
  
  // Configuración de imágenes
  images: {
    // Necesario para exportación estática
    unoptimized: true,
    // Dominios permitidos para imágenes externas
    domains: [
      'firebasestorage.googleapis.com',
      'lh3.googleusercontent.com',
      'localhost'
    ],
  },
  
  // Configuración de webpack para manejar archivos PDF y otros binarios
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(pdf|jpe?g|png|gif|woff|woff2|eot|ttf|svg)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            publicPath: '/_next/static/files',
            outputPath: 'static/files',
          },
        },
      ],
    });
    
    return config;
  },
  
  // Configuración de entorno para desarrollo y producción
  env: {
    // Variables de entorno públicas (accesibles en el cliente)
    // Las variables NEXT_PUBLIC_* ya están disponibles automáticamente
  },
  
  // Configuración de transpilación
  transpilePackages: [
    // Añade aquí paquetes que necesiten ser transpilados
  ],
  
  // Configuración experimental
  experimental: {
    // Habilitar características experimentales si es necesario
  },
};

// Exportar la configuración usando sintaxis de módulos ES
export default nextConfig;
