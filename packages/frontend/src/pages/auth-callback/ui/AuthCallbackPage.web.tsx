export function AuthCallbackPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mx-auto"></div>
        <p className="mt-6 text-slate-700 font-medium text-lg">Entrando...</p>
        <p className="mt-2 text-sm text-slate-500">Aguarde enquanto redirecionamos você</p>
      </div>
    </div>
  );
}

export function AuthCallbackLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mx-auto"></div>
        <p className="mt-6 text-slate-700 font-medium text-lg">Carregando...</p>
      </div>
    </div>
  );
}
