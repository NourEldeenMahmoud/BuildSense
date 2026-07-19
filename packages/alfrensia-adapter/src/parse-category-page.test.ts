import { describe, it, expect } from 'vitest';
import { parseCategoryPage } from './parse-category-page.js';

describe('parseCategoryPage', () => {
  it('should extract product cards from Flatsome theme', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body>
        <div class="products">
          <div class="product-small col has-hover product type-product post-135230 status-publish instock product_cat-monitors" data-product_id="135230" data-product_title="Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor">
            <div class="product-small box">
              <div class="title-wrapper">
                <p class="name product-title woocommerce-loop-product__title">
                  <a href="https://alfrensia.com/en/product/gigabyte-gs27qca-27-inch-qhd-180hz-1ms-mprt-curved-va-gaming-monitor/" class="woocommerce-LoopProduct-link woocommerce-loop-product__link">Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor</a>
                </p>
              </div>
              <div class="price-wrapper">
                <span class="price"><span class="woocommerce-Price-amount amount"><bdi>6,999.00&nbsp;<span class="woocommerce-Price-currencySymbol">EGP</span></bdi></span></span>
              </div>
              <div class="add-to-cart-button">
                <a href="/en/product-category/monitors/?add-to-cart=135230" data-quantity="1" class="button add_to_cart_button ajax_add_to_cart" data-product_id="135230" data-product_sku="889523044490">Add to cart</a>
              </div>
            </div>
          </div>
          <div class="product-small col has-hover product type-product post-134604 status-publish instock product_cat-monitors" data-product_id="134604" data-product_title="MSI PRO MP165 E6 15.6 Inch FHD 60Hz IPS USB-C Portable Monitor">
            <div class="product-small box">
              <div class="title-wrapper">
                <p class="name product-title woocommerce-loop-product__title">
                  <a href="https://alfrensia.com/en/product/msi-pro-mp165-e6-15-6-inch-fhd-60hz-ips-usb-c-portable-monitor/" class="woocommerce-LoopProduct-link woocommerce-loop-product__link">MSI PRO MP165 E6 15.6 Inch FHD 60Hz IPS USB-C Portable Monitor</a>
                </p>
              </div>
              <div class="price-wrapper">
                <span class="price"><span class="woocommerce-Price-amount amount"><bdi>4,999.00&nbsp;<span class="woocommerce-Price-currencySymbol">EGP</span></bdi></span></span>
              </div>
            </div>
          </div>
        </div>
        <nav class="woocommerce-pagination">
          <ul class="page-numbers">
            <li><span class="page-numbers current">1</span></li>
            <li><a href="https://alfrensia.com/en/product-category/monitors/page/2/" class="page-numbers">2</a></li>
            <li><a href="https://alfrensia.com/en/product-category/monitors/page/2/" class="next page-numbers">Next</a></li>
          </ul>
        </nav>
      </body>
      </html>
    `;

    const result = parseCategoryPage(html);

    expect(result.products).toHaveLength(2);
    expect(result.products[0]?.externalId).toBe('135230');
    expect(result.products[0]?.name).toBe('Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor');
    expect(result.products[0]?.canonicalUrl).toBe('https://alfrensia.com/en/product/gigabyte-gs27qca-27-inch-qhd-180hz-1ms-mprt-curved-va-gaming-monitor/');
    expect(result.products[0]?.sku).toBe('889523044490');
    expect(result.products[1]?.externalId).toBe('134604');
    expect(result.products[1]?.name).toBe('MSI PRO MP165 E6 15.6 Inch FHD 60Hz IPS USB-C Portable Monitor');
    expect(result.pagination.totalItems).toBeGreaterThan(0);
    expect(result.pagination.isNext).toBe(true);
    expect(result.pagination.isPrevious).toBe(false);
  });

  it('should handle products with sale prices', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body>
        <div class="products">
          <div class="product-small col has-hover product type-product post-123456 status-publish instock product_cat-monitors" data-product_id="123456">
            <div class="product-small box">
              <div class="title-wrapper">
                <p class="name product-title woocommerce-loop-product__title">
                  <a href="https://alfrensia.com/en/product/test-monitor/" class="woocommerce-LoopProduct-link">Test Monitor</a>
                </p>
              </div>
              <div class="price-wrapper">
                <span class="price">
                  <del><span class="woocommerce-Price-amount amount"><bdi>5,999.00&nbsp;<span class="woocommerce-Price-currencySymbol">EGP</span></bdi></span></del>
                  <ins><span class="woocommerce-Price-amount amount"><bdi>4,999.00&nbsp;<span class="woocommerce-Price-currencySymbol">EGP</span></bdi></span></ins>
                </span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = parseCategoryPage(html);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.priceText).toContain('4,999');
    expect(result.products[0]?.oldPriceText).toContain('5,999');
  });
});
