export default function RecipeCardSkeleton({ count = 1, className = '' }) {
  return (
    <div className={`recipe-skeleton-list ${className}`.trim()}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={`recipe-skeleton-${index}`} className="recipe-card recipe-card-skeleton" aria-hidden="true">
          <div className="recipe-card-skeleton__thumb shimmer-block" />
          <div className="recipe-card-skeleton__body">
            <div className="recipe-card-skeleton__title shimmer-block" />
            <div className="recipe-card-skeleton__meta-row">
              <div className="recipe-card-skeleton__badge shimmer-block" />
              <div className="recipe-card-skeleton__tag shimmer-block" />
            </div>
            <div className="recipe-card-skeleton__line shimmer-block" />
            <div className="recipe-card-skeleton__line recipe-card-skeleton__line--short shimmer-block" />
          </div>
        </div>
      ))}
    </div>
  )
}
