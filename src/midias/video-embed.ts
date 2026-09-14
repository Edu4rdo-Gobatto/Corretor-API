export function normalizar_video_embed(valor: string): string | null {
  let url: URL;
  try { url = new URL(valor); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const partes = url.pathname.split('/').filter(Boolean);
  const youtube = /^[A-Za-z0-9_-]{11}$/;
  if (host === 'youtu.be' && partes.length === 1 && youtube.test(partes[0])) return `https://www.youtube-nocookie.com/embed/${partes[0]}`;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.pathname === '/watch' && url.searchParams.getAll('v').length === 1 ? url.searchParams.get('v') : partes.length === 2 && ['embed', 'shorts'].includes(partes[0]) ? partes[1] : null;
    return id && youtube.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com' && partes.length === 1 && /^\d+$/.test(partes[0])) return `https://player.vimeo.com/video/${partes[0]}`;
  if (host === 'player.vimeo.com' && partes.length === 2 && partes[0] === 'video' && /^\d+$/.test(partes[1])) return `https://player.vimeo.com/video/${partes[1]}`;
  return null;
}
