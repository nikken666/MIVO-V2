export default function ProductsLoading() {
  return (
    <main className="container pageShell">
      <div className="catalogLoadingHeader skeletonBlock" />
      <div className="catalogLoadingGrid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="catalogLoadingCard" key={index}>
            <div className="catalogLoadingImage skeletonBlock" />
            <div className="catalogLoadingLine skeletonBlock" />
            <div className="catalogLoadingLine short skeletonBlock" />
            <div className="catalogLoadingLine price skeletonBlock" />
          </div>
        ))}
      </div>
    </main>
  );
}
