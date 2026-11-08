export function LoadingState({ lines = 4 }: { lines?: number }) {
  return <div className="skeleton-list" aria-label="Carregando">{Array.from({ length: lines }, (_, index) => <span key={index} className="skeleton" />)}</div>
}
