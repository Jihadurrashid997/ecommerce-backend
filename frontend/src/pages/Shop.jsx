import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    FaArrowRight,
    FaBoxOpen,
    FaCheckCircle,
    FaHeart,
    FaSearch,
    FaShieldAlt,
    FaShoppingBag,
    FaSlidersH,
    FaStore
} from "react-icons/fa";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import "../styles/Home.css";
import "../styles/Shop.css";

const PAGE_SIZE = 12;

const Shop = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [keyword, setKeyword] = useState(
        (searchParams.get("search") || searchParams.get("q") || "").trim()
    );
    const [category, setCategory] = useState(
        (searchParams.get("category") || "").trim()
    );
    const [sort, setSort] = useState("stock");
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [retry, setRetry] = useState(0);
    const [marketplaceState, setMarketplaceState] = useState("loading");
    const [marketplaceMessage, setMarketplaceMessage] = useState("");
    const [settingsRetry, setSettingsRetry] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api.get("/admin/settings")
            .then(response => {
                if (cancelled) return;
                const enabled = response.data?.settings?.marketplaceEnabled;
                setMarketplaceState(enabled ? "open" : "closed");
                setMarketplaceMessage("");
            })
            .catch(error => {
                if (cancelled) return;
                setMarketplaceState("error");
                setMarketplaceMessage(
                    error.response?.data?.message ||
                    "Shop availability couldn't be checked. Please try again."
                );
            });

        return () => { cancelled = true; };
    }, [settingsRetry]);

    useEffect(() => {
        const urlSearch = (searchParams.get("search") || searchParams.get("q") || "").trim();
        const urlCategory = (searchParams.get("category") || "").trim();
        setKeyword(previous => previous === urlSearch ? previous : urlSearch);
        setCategory(previous => previous === urlCategory ? previous : urlCategory);
    }, [searchParams]);

    useEffect(() => {
        const params = {};
        if (keyword.trim()) params.search = keyword.trim();
        if (category) params.category = category;
        setSearchParams(params, { replace: true });
    }, [keyword, category, setSearchParams]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    useEffect(() => {
        let cancelled = false;
        const loadProducts = async () => {
            if (marketplaceState !== "open") return;
            try {
                setLoading(true);
                setError("");

                const response = await api.get("/products", {
                    timeout: 12000,
                    params: {
                        keyword: keyword.trim(),
                        category,
                        sort,
                        page,
                        limit: PAGE_SIZE
                    }
                });
                if (cancelled) return;

                const result = response.data || {};
                const list = Array.isArray(result.products) ? result.products : [];
                setProducts(list);
                setCategories(Array.isArray(result.categories) ? result.categories : []);
                setTotalItems(Number(result.pagination?.totalItems) || 0);
                setTotalPages(Math.max(Number(result.pagination?.totalPages) || 1, 1));
            } catch (err) {
                if (cancelled) return;
                console.error("PRODUCT LOAD ERROR:", err);
                setProducts([]);
                setCategories([]);
                setTotalItems(0);
                setTotalPages(1);
                setError(err.response?.data?.message || "Products couldn't load. Please try again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadProducts();

        return () => {
            cancelled = true;
        };
    }, [retry, marketplaceState, keyword, category, sort, page]);

    const safePage = Math.min(page, totalPages);
    const visibleProducts = products;

    const updateCategory = value => {
        setCategory(value);
        setPage(1);
    };

    const clearFilters = () => {
        setKeyword("");
        setCategory("");
        setSort("stock");
        setPage(1);
    };

    return (
        <main className="shop-premium">
            {marketplaceState === "closed" && (
                <div className="shop-state">
                    <span className="shop-state-icon"><FaStore /></span>
                    <h2>The Shop is temporarily closed.</h2>
                    <p>Please come back later.</p>
                </div>
            )}
            {marketplaceState === "error" && (
                <div className="shop-state shop-error" role="alert">
                    <span className="shop-state-icon"><FaBoxOpen /></span>
                    <h2>Shop status unavailable.</h2>
                    <p>{marketplaceMessage}</p>
                    <button type="button" onClick={() => setSettingsRetry(value => value + 1)}>
                        Try again
                    </button>
                </div>
            )}
            {marketplaceState === "loading" && (
                <p className="shop-state" role="status">Checking Shop availability...</p>
            )}
            {marketplaceState === "open" && (
            <>
            <section className="shop-hero">
                <div className="shop-hero-copy">
                    <span className="shop-kicker"><FaStore /> THE E TOP MARKET</span>
                    <h1>Find things<br />with <em>a little more soul.</em></h1>
                    <p>Independent finds, thoughtful goods, and pieces worth keeping. All in one place.</p>
                    <a className="shop-hero-link" href="#shop-collection">Explore the collection <FaArrowRight /></a>
                </div>
                <div className="shop-hero-art" aria-hidden="true">
                    <div className="shop-art-sun" />
                    <div className="shop-art-shape shop-art-shape-back" />
                    <div className="shop-art-shape shop-art-shape-front">
                        <FaShoppingBag />
                        <span>MADE<br />TO BE<br /><em>FOUND.</em></span>
                    </div>
                    <span className="shop-art-spark">✳</span>
                    <span className="shop-art-caption">GOOD THINGS,<br />GOOD PEOPLE.</span>
                </div>
                <div className="shop-hero-bottom">
                    <span><FaCheckCircle /> A community marketplace</span>
                    <span><FaShieldAlt /> Shop from independent sellers</span>
                    <span><FaHeart /> Finds worth sharing</span>
                </div>
            </section>

            <section className="shop-assurance" aria-label="Marketplace values">
                <div><span className="shop-assurance-icon"><FaStore /></span><span><b>Shop independent goods</b><small>Seller profiles stay private</small></span></div>
                <div><span className="shop-assurance-icon"><FaShieldAlt /></span><span><b>Shop with confidence</b><small>Secure checkout, clear orders</small></span></div>
                <div><span className="shop-assurance-icon"><FaHeart /></span><span><b>Find your next favorite</b><small>Thoughtful picks from the community</small></span></div>
            </section>

            <section className="shop-collection" id="shop-collection">
                <header className="shop-collection-heading">
                    <div>
                        <span className="shop-kicker">A GOOD PLACE TO START</span>
                        <h2>Browse the collection</h2>
                        <p>Explore what the E Top community has on offer.</p>
                    </div>
                    {!loading && !error && (
                        <span className="shop-result-count">
                            <b>{totalItems}</b> {totalItems === 1 ? "find" : "finds"}
                        </span>
                    )}
                </header>

                <div className="shop-controls">
                    <label className="shop-search">
                        <FaSearch aria-hidden="true" />
                        <input
                            type="search"
                            value={keyword}
                            onChange={event => {
                                setKeyword(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Search products and finds..."
                            aria-label="Search products"
                        />
                        {keyword && (
                            <button type="button" onClick={() => setKeyword("")} aria-label="Clear search">×</button>
                        )}
                    </label>
                    <label className="shop-sort">
                        <FaSlidersH aria-hidden="true" />
                        <span>Sort</span>
                        <select
                            value={sort}
                            onChange={event => {
                                setSort(event.target.value);
                                setPage(1);
                            }}
                            aria-label="Sort products"
                        >
                            <option value="stock">In stock first</option>
                            <option value="newest">Newest</option>
                            <option value="price-low">Price: low to high</option>
                            <option value="price-high">Price: high to low</option>
                        </select>
                    </label>
                </div>

                <div className="shop-categories" aria-label="Filter by category">
                    <button type="button" className={!category ? "active" : ""} onClick={() => updateCategory("")}>Everything</button>
                    {categories.map(item => (
                        <button
                            type="button"
                            key={item}
                            className={category === item ? "active" : ""}
                            onClick={() => updateCategory(category === item ? "" : item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="shop-state shop-error">
                        <span className="shop-state-icon"><FaBoxOpen /></span>
                        <h3>We couldn't bring the collection in.</h3>
                        <p>{error}</p>
                        <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>
                    </div>
                )}

                {loading && (
                    <div className="shop-grid" aria-label="Loading products">
                        {Array.from({ length: 8 }, (_, index) => (
                            <div className="shop-skeleton" key={index}>
                                <span /><div /><div />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && !error && visibleProducts.length === 0 && (
                    <div className="shop-state">
                        <span className="shop-state-icon"><FaSearch /></span>
                        <h3>No finds on this shelf just yet.</h3>
                        <p>Try another search or clear your filters to see everything.</p>
                        <button type="button" onClick={clearFilters}>Clear filters</button>
                    </div>
                )}

                {!loading && !error && visibleProducts.length > 0 && (
                    <div className="shop-product-grid">
                        {visibleProducts.map(product => (
                            <ProductCard key={product._id || product.id} product={product} />
                        ))}
                    </div>
                )}

                {!loading && !error && totalPages > 1 && (
                    <nav className="shop-pagination" aria-label="Product pages">
                        <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button>
                        <span>Page <b>{safePage}</b> of <b>{totalPages}</b></span>
                        <button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next <FaArrowRight /></button>
                    </nav>
                )}
            </section>

            <footer className="shop-maker-note">
                <span className="shop-maker-mark">E</span>
                <div><span className="shop-kicker">MORE THAN A MARKETPLACE</span><h2>Every good find has a story.</h2><p>And behind it, a person. Discover the community behind the things you love.</p></div>
                <Link to="/reels">Meet the community <FaArrowRight /></Link>
            </footer>
            </>
            )}
        </main>
    );
};

export default Shop;
