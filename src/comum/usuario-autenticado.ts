export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  cargo: 'ADMIN' | 'CORRETOR';
}
