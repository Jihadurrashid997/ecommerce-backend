import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { getUploadUrl } from "../services/api";
import { getCartItemKey, useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import "../styles/ProductDetails.css";

const ProductDetails = () => {

    const { id } = useParams();
    const navigate = useNavigate();
    const { cart, addToCart } = useCart();
    const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();

    const [product, setProduct] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reviews, setReviews] = useState([]);
    const [reviewSummary, setReviewSummary] = useState({ averageRating: 0, reviewCount: 0 });
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewTotalPages, setReviewTotalPages] = useState(1);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewMessage, setReviewMessage] = useState("");
    const [reviewError, setReviewError] = useState("");
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");

        api.get(`/products/${id}`)
            .then(response => {
                if (!cancelled) setProduct(response.data);
            })
            .catch(requestError => {
                if (cancelled) return;
                console.error("Could not load product details:", requestError);
                setProduct(null);
                setError(
                    requestError.response?.data?.message ||
                    "Could not load this product."
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        const firstVariantId = product?.variants?.find(
            variant => variant.stock > 0
        )?._id || product?.variants?.[0]?._id || "";
        setSelectedVariantId(firstVariantId);
    }, [product]);

    useEffect(() => {
        let cancelled = false;
        api.get(`/products/${id}/reviews`, {
            params: { page: reviewPage, limit: 10 }
        })
            .then(response => {
                if (cancelled) return;
                setReviews(Array.isArray(response.data?.reviews) ? response.data.reviews : []);
                setReviewSummary(response.data?.summary || { averageRating: 0, reviewCount: 0 });
                setReviewTotalPages(Math.max(Number(response.data?.pagination?.totalPages) || 1, 1));
            })
            .catch(requestError => {
                if (cancelled) return;
                setReviewError(
                    requestError.response?.data?.message ||
                    "Could not load product reviews."
                );
            });
        return () => { cancelled = true; };
    }, [id, reviewPage]);

    const submitReview = async event => {
        event.preventDefault();
        setReviewError("");
        setReviewMessage("");
        setReviewSubmitting(true);
        try {
            const response = await api.post(`/products/${id}/reviews`, {
                rating: Number(reviewRating),
                comment: reviewComment
            });
            setReviewMessage(response.data?.message || "Review submitted.");
            setReviewComment("");
            setReviewPage(1);
            const reviewsResponse = await api.get(`/products/${id}/reviews`, {
                params: { page: 1, limit: 10 }
            });
            setReviews(reviewsResponse.data?.reviews || []);
            setReviewSummary(reviewsResponse.data?.summary || { averageRating: 0, reviewCount: 0 });
            setReviewTotalPages(Math.max(Number(reviewsResponse.data?.pagination?.totalPages) || 1, 1));
        } catch (requestError) {
            setReviewError(
                requestError.response?.data?.message ||
                "Could not submit your review."
            );
        } finally {
            setReviewSubmitting(false);
        }
    };

    if(loading){

        return(

            <div className="loader"></div>

        );

    }

    if(!product){

        return(

            <div>
                <h2 style={{textAlign:"center"}}>

                    Product Not Found

                </h2>
                {error && <p role="alert">{error}</p>}
            </div>

        );

    }

    const productId = String(product._id || product.id || "");
    const selectedVariant = product.variants?.find(
        variant => String(variant._id) === String(selectedVariantId)
    );
    const purchasableProduct = selectedVariant
        ? {
            ...product,
            variantId: selectedVariant._id,
            variantName: selectedVariant.name,
            sku: selectedVariant.sku,
            price: selectedVariant.price,
            stock: selectedVariant.stock,
            image: selectedVariant.image || product.image
        }
        : product;
    const stock = Number(purchasableProduct.stock ?? 1);
    const cartItemKey = getCartItemKey(purchasableProduct);
    const cartQuantity = cart.find(
        item => getCartItemKey(item) === cartItemKey
    )?.quantity || 0;
    const cartLimitReached = cartQuantity >= stock;
    const isWishlisted = wishlist.some(
        item => String(item._id || item.id) === productId
    );
    const addProductToCart = () => {
        if (stock > 0 && !cartLimitReached) {
            addToCart(purchasableProduct);
        }
    };

    return(

        <>
        <div className="product-details">

            <div className="product-left">

                <img

                src={getUploadUrl(purchasableProduct.image)}

                alt={product.name}

                />

            </div>

            <div className="product-right">

                <h1>

                    {product.name}

                </h1>

                <h2>

                    ৳ {purchasableProduct.price}

                </h2>
                {product.variants?.length > 0 && (
                    <label className="product-variant-select">
                        Choose option
                        <select
                            value={selectedVariantId}
                            onChange={event => setSelectedVariantId(event.target.value)}
                        >
                            {product.variants.map(variant => (
                                <option key={variant._id} value={variant._id} disabled={variant.stock <= 0}>
                                    {variant.name} · {variant.sku} · ৳{variant.price} · {variant.stock} in stock
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <p>

                    {product.description}

                </p>

                <p>{stock > 0 ? `${stock} in stock` : "Sold out"}</p>

                <button
                    className="buy-btn"
                    disabled={stock <= 0}
                    onClick={() => {
                        if (cartQuantity === 0) addToCart(purchasableProduct);
                        navigate("/shop/checkout");
                    }}
                >

                    {stock <= 0 ? "Sold out" : "Buy Now"}

                </button>

                <button
                    className="cart-btn"
                    disabled={stock <= 0 || cartLimitReached}
                    onClick={addProductToCart}
                >

                    {stock <= 0
                        ? "Sold out"
                        : cartLimitReached
                            ? "Stock limit reached"
                            : "Add To Cart"}

                </button>

                <button
                    className="wish-btn"
                    onClick={() => isWishlisted
                        ? removeFromWishlist(productId)
                        : addToWishlist(product)}
                >

                    {isWishlisted ? "Remove From Wishlist" : "Add To Wishlist"}

                </button>

            </div>

        </div>

        <section className="product-reviews" aria-labelledby="product-reviews-heading">
            <header>
                <div>
                    <h2 id="product-reviews-heading">Customer reviews</h2>
                    <p>
                        {reviewSummary.reviewCount > 0
                            ? `${Number(reviewSummary.averageRating).toFixed(1)} / 5 · ${reviewSummary.reviewCount} verified review${reviewSummary.reviewCount === 1 ? "" : "s"}`
                            : "No reviews yet"}
                    </p>
                </div>
            </header>

            {reviewError && <p className="product-review-error" role="alert">{reviewError}</p>}
            {reviewMessage && <p className="product-review-message" role="status">{reviewMessage}</p>}

            <form className="product-review-form" onSubmit={submitReview}>
                <label>
                    Rating
                    <select
                        value={reviewRating}
                        onChange={event => setReviewRating(Number(event.target.value))}
                    >
                        {[5, 4, 3, 2, 1].map(rating => (
                            <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Your review
                    <textarea
                        value={reviewComment}
                        onChange={event => setReviewComment(event.target.value)}
                        minLength={3}
                        maxLength={1000}
                        required
                        rows={4}
                        placeholder="Share your experience with this product"
                    />
                </label>
                <button type="submit" disabled={reviewSubmitting}>
                    {reviewSubmitting ? "Submitting..." : "Submit verified review"}
                </button>
                <small>Only buyers with a paid, delivered order can review. One review per product per order.</small>
            </form>

            <div className="product-review-list">
                {reviews.length === 0 && !reviewError ? (
                    <p>Be the first verified buyer to review this product.</p>
                ) : reviews.map(review => (
                    <article className="product-review" key={review._id}>
                        <div>
                            <strong>{review.buyer?.name || "Verified buyer"}</strong>
                            <span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                        </div>
                        <p>{review.comment}</p>
                        <small>{new Date(review.createdAt).toLocaleDateString()}</small>
                    </article>
                ))}
            </div>

            {reviewTotalPages > 1 && (
                <nav className="product-review-pagination" aria-label="Product review pages">
                    <button type="button" disabled={reviewPage <= 1} onClick={() => setReviewPage(page => page - 1)}>Previous</button>
                    <span>Page {reviewPage} of {reviewTotalPages}</span>
                    <button type="button" disabled={reviewPage >= reviewTotalPages} onClick={() => setReviewPage(page => page + 1)}>Next</button>
                </nav>
            )}
        </section>
        </>

    );

};

export default ProductDetails;
