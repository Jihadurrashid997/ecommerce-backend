const mongoose = require("mongoose");

const MAX_VARIANTS_PER_PRODUCT = 100;

const parseProductVariants = rawValue => {
    let rawVariants = rawValue;
    if (typeof rawVariants === "string") {
        try {
            rawVariants = JSON.parse(rawVariants);
        } catch (_error) {
            return { error: "Product variants must be valid JSON." };
        }
    }

    if (
        !Array.isArray(rawVariants) ||
        rawVariants.length < 1 ||
        rawVariants.length > MAX_VARIANTS_PER_PRODUCT
    ) {
        return {
            error: `Provide between 1 and ${MAX_VARIANTS_PER_PRODUCT} product variants.`
        };
    }

    const seenSkus = new Set();
    const variants = [];
    let totalStock = 0;
    for (const variant of rawVariants) {
        const name = String(variant?.name || "").trim();
        const sku = String(variant?.sku || "").trim().toUpperCase();
        const price = Number(variant?.price);
        const stock = Number(variant?.stock);
        const image = String(variant?.image || "").trim();
        const variantId = variant?._id;

        if (
            !name ||
            name.length > 80 ||
            !/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku) ||
            seenSkus.has(sku) ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isSafeInteger(stock) ||
            stock < 0 ||
            image.length > 500 ||
            (
                variantId &&
                !mongoose.Types.ObjectId.isValid(String(variantId))
            )
        ) {
            return {
                error: "Each variant needs a unique SKU, name, positive price, whole-number stock, and image URL under 500 characters."
            };
        }

        seenSkus.add(sku);
        totalStock += stock;
        if (!Number.isSafeInteger(totalStock)) {
            return { error: "Total variant stock is too large." };
        }
        variants.push({
            ...(variantId ? { _id: variantId } : {}),
            name,
            sku,
            price,
            stock,
            image
        });
    }

    return {
        variants,
        totalStock,
        displayPrice: Math.min(...variants.map(variant => variant.price))
    };
};

module.exports = { parseProductVariants };
