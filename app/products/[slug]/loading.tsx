export default function ProductDetailLoading() {
  return (
    <main className="productDetailPage">
      <div className="container">
        <div className="detailLoadingBreadcrumb skeletonBlock" />

        <section className="productDetailCommerce">
          <div className="detailLoadingGallery skeletonBlock" />

          <div className="detailLoadingPanel">
            <div className="detailLoadingLine small skeletonBlock" />
            <div className="detailLoadingLine title skeletonBlock" />
            <div className="detailLoadingLine medium skeletonBlock" />
            <div className="detailLoadingPrice skeletonBlock" />
            <div className="detailLoadingBox skeletonBlock" />
            <div className="detailLoadingOptions">
              <div className="detailLoadingOption skeletonBlock" />
              <div className="detailLoadingOption skeletonBlock" />
              <div className="detailLoadingOption skeletonBlock" />
            </div>
            <div className="detailLoadingActions">
              <div className="skeletonBlock" />
              <div className="skeletonBlock" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
