export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  cargo: 'ADMIN' | 'CORRETOR';
}
