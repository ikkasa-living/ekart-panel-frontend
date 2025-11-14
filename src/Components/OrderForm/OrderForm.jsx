import React, { useState, useEffect } from "react";
import Select from "react-select";
import { MdDelete } from "react-icons/md";
import { toast } from "react-toastify";
import "./OrderForm.css";

const API_URL = import.meta.env.VITE_API_URL;

const stateOptions = [
  { value: "Andhra Pradesh", label: "Andhra Pradesh" },
  { value: "Arunachal Pradesh", label: "Arunachal Pradesh" },
  { value: "Assam", label: "Assam" },
  { value: "Bihar", label: "Bihar" },
  { value: "Chhattisgarh", label: "Chhattisgarh" },
  { value: "Goa", label: "Goa" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Haryana", label: "Haryana" },
  { value: "Himachal Pradesh", label: "Himachal Pradesh" },
  { value: "Jharkhand", label: "Jharkhand" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Kerala", label: "Kerala" },
  { value: "Madhya Pradesh", label: "Madhya Pradesh" },
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Manipur", label: "Manipur" },
  { value: "Meghalaya", label: "Meghalaya" },
  { value: "Mizoram", label: "Mizoram" },
  { value: "Nagaland", label: "Nagaland" },
  { value: "Odisha", label: "Odisha" },
  { value: "Punjab", label: "Punjab" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Sikkim", label: "Sikkim" },
  { value: "Tamil Nadu", label: "Tamil Nadu" },
  { value: "Telangana", label: "Telangana" },
  { value: "Tripura", label: "Tripura" },
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "Uttarakhand", label: "Uttarakhand" },
  { value: "West Bengal", label: "West Bengal" },
  { value: "Andaman and Nicobar Islands", label: "Andaman and Nicobar Islands" },
  { value: "Chandigarh", label: "Chandigarh" },
  { value: "Dadra and Nagar Haveli and Daman and Diu", label: "Dadra and Nagar Haveli and Daman and Diu" },
  { value: "Delhi", label: "Delhi" },
  { value: "Jammu and Kashmir", label: "Jammu and Kashmir" },
  { value: "Ladakh", label: "Ladakh" },
  { value: "Lakshadweep", label: "Lakshadweep" },
  { value: "Puducherry", label: "Puducherry" }
];

// ✅ SIMPLIFIED: Only essential fields
const initialOrder = {
  shopifyId: "",
  orderId: "",
  orderDate: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  city: "",
  state: "",
  pincode: "",
  products: [{ 
    productName: "", 
    quantity: 1,
    imageUrl: "",              // ✅ Image URL for CSV/Shopify
    uploadedImageUrl: "",      // ✅ Image URL for user uploads
    category: "Home",
    price: 0,
  }],
  deadWeight: "",
  length: "",
  breadth: "",
  height: "",
  volumetricWeight: "",
  amount: "",
  paymentMode: "COD",
  hsnCode: "",
  invoiceReference: "",
  status: "New",
  destinationName: "Ikkasa Warehouse",
  destinationAddressLine1: "",
  destinationAddressLine2: "",
  destinationCity: "",
  destinationState: "",
  destinationPincode: "",
  destinationPhone: "",
};

export default function OrderForm({ onSave, onClose, editData }) {
  const [order, setOrder] = useState(initialOrder);
  const [uploadingProductIndex, setUploadingProductIndex] = useState(null);

  useEffect(() => {
    if (editData) {
      setOrder({
        ...initialOrder,
        ...editData,
        orderDate: editData.orderDate
          ? new Date(editData.orderDate).toISOString().substr(0, 10)
          : "",
        products:
          editData.products && editData.products.length > 0
            ? editData.products.map((p) => ({
                productName: p.productName || "",
                quantity: Number(p.quantity) || 1,
                imageUrl: p.imageUrl || "",              // ✅ Preserve existing image
                uploadedImageUrl: p.uploadedImageUrl || "", // ✅ Preserve uploaded image
                category: p.category || "Home",
                price: p.price || 0,
              }))
            : [{ 
                productName: "", 
                quantity: 1,
                imageUrl: "",
                uploadedImageUrl: "",
                category: "Home",
                price: 0,
              }],
        deadWeight: editData.deadWeight ?? "",
        length: editData.length ?? "",
        breadth: editData.breadth ?? "",
        height: editData.height ?? "",
        volumetricWeight: editData.volumetricWeight ?? "",
        amount: editData.amount ?? "",
        paymentMode: editData.paymentMode ?? "COD",
        status: editData.status || "New",
      });
    } else {
      setOrder(initialOrder);
    }
    setUploadingProductIndex(null);
  }, [editData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numberFields = [
      "deadWeight", "length", "breadth", "height",
      "volumetricWeight", "amount"
    ];
    setOrder({
      ...order,
      [name]: numberFields.includes(name)
        ? value === "" ? "" : Number(value)
        : value,
    });
  };

  // ✅ FIXED: Preserve images when editing product
  const handleProductChange = (i, field, value) => {
    const newProducts = [...order.products];
    newProducts[i] = {
      ...newProducts[i],
      [field]: field === "quantity" ? (value === "" ? "" : Number(value)) : 
               field === "price" ? (value === "" ? "" : Number(value)) :
               value,
      // ✅ CRITICAL: Always preserve image URLs
      imageUrl: newProducts[i].imageUrl,
      uploadedImageUrl: newProducts[i].uploadedImageUrl,
    };
    setOrder({ ...order, products: newProducts });
  };

  const addProduct = () => {
    setOrder({
      ...order,
      products: [...order.products, { 
        productName: "", 
        quantity: 1,
        imageUrl: "",
        uploadedImageUrl: "",
        category: "Home",
        price: 0,
      }],
    });
  };

  const removeProduct = (i) => {
    const filtered = [...order.products];
    filtered.splice(i, 1);
    setOrder({ ...order, products: filtered });
  };

  // ✅ NEW: Handle image upload for each product
  const handleProductImageUpload = async (e, productIndex) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setUploadingProductIndex(productIndex);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${API_URL}/api/ekart/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.url) {
        const uploadedUrl = response.data.url;
        const newProducts = [...order.products];
        newProducts[productIndex] = {
          ...newProducts[productIndex],
          uploadedImageUrl: uploadedUrl,  // ✅ Store uploaded URL
        };
        setOrder({ ...order, products: newProducts });
        toast.success(`✅ Image uploaded for ${newProducts[productIndex].productName}`);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("❌ Failed to upload image");
    } finally {
      setUploadingProductIndex(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Validation
    if (!order.customerName || !order.customerPhone || !order.customerAddress) {
      toast.error("❌ Please fill in required customer details");
      return;
    }

    const validProducts = order.products.filter(
      (item) => item.productName.trim() && item.quantity > 0
    );

    if (validProducts.length === 0) {
      toast.error("❌ Please add at least one product");
      return;
    }

    // ✅ Build payload with all required fields
    const payload = {
      shopifyId: order.shopifyId || "",
      orderId: order.orderId,
      orderDate: order.orderDate ? new Date(order.orderDate) : undefined,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      // ✅ CRITICAL: Include imageUrl for all products
      products: validProducts.map(p => ({
        productName: p.productName,
        quantity: Number(p.quantity),
        imageUrl: p.imageUrl || "",              // ✅ Always include
        uploadedImageUrl: p.uploadedImageUrl || "", // ✅ Always include
        category: p.category || "Home",
        price: Number(p.price) || 0,
      })),
      deadWeight: order.deadWeight === "" ? undefined : Number(order.deadWeight),
      length: order.length === "" ? undefined : Number(order.length),
      breadth: order.breadth === "" ? undefined : Number(order.breadth),
      height: order.height === "" ? undefined : Number(order.height),
      volumetricWeight: order.volumetricWeight === "" ? undefined : Number(order.volumetricWeight),
      amount: order.amount === "" ? undefined : Number(order.amount),
      paymentMode: order.paymentMode || "COD",
      hsnCode: order.hsnCode || "",
      invoiceReference: order.invoiceReference || "",
      status: order.status || "New",
      destinationName: order.destinationName || "Ikkasa Warehouse",
      destinationAddressLine1: order.destinationAddressLine1 || "",
      destinationAddressLine2: order.destinationAddressLine2 || "",
      destinationCity: order.destinationCity || "",
      destinationState: order.destinationState || "",
      destinationPincode: order.destinationPincode || "",
      destinationPhone: order.destinationPhone || "",
    };

    console.log("📤 Submitting payload:", payload.products.map(p => ({
      name: p.productName,
      hasImageUrl: !!p.imageUrl,
      hasUploadedImageUrl: !!p.uploadedImageUrl,
    })));

    onSave(payload);
  };

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <button type="button" className="close-btn" onClick={onClose}>✕</button>
      <h2>{editData ? "📝 Edit Order" : "✨ Create New Order"}</h2>

      {/* ========== CUSTOMER DETAILS SECTION ========== */}
      <div className="form-section">
        <h3>👤 Customer Details</h3>
        <div className="form-grid">
          <div>
            <label>Shopify ID:</label>
            <input 
              name="shopifyId" 
              value={order.shopifyId} 
              onChange={handleChange}
              placeholder="Optional"
            />
          </div>

          <div>
            <label>Order ID <span className="required">*</span>:</label>
            <input 
              name="orderId" 
              value={order.orderId} 
              onChange={handleChange}
              placeholder="e.g., 1001"
              required 
            />
          </div>

          <div>
            <label>Order Date <span className="required">*</span>:</label>
            <input 
              type="date" 
              name="orderDate" 
              value={order.orderDate} 
              onChange={handleChange}
              required 
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label>Customer Name <span className="required">*</span>:</label>
            <input 
              name="customerName" 
              value={order.customerName} 
              onChange={handleChange}
              placeholder="John Doe"
              required 
            />
          </div>

          <div>
            <label>Phone <span className="required">*</span>:</label>
            <input 
              name="customerPhone" 
              value={order.customerPhone} 
              onChange={handleChange}
              placeholder="9876543210"
              required 
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label>Address <span className="required">*</span>:</label>
            <textarea 
              name="customerAddress" 
              value={order.customerAddress} 
              onChange={handleChange}
              placeholder="Full address"
              rows="2"
              required 
            />
          </div>

          <div>
            <label>City:</label>
            <input 
              name="city" 
              value={order.city} 
              onChange={handleChange}
              placeholder="New Delhi"
            />
          </div>

          <div>
            <label>State:</label>
            <Select
              options={stateOptions}
              value={stateOptions.find((opt) => opt.value === order.state) || null}
              onChange={(selected) =>
                setOrder({ ...order, state: selected ? selected.value : "" })
              }
              isClearable
              isSearchable
              placeholder="Select state"
            />
          </div>

          <div>
            <label>Pincode:</label>
            <input 
              name="pincode" 
              value={order.pincode} 
              onChange={handleChange}
              placeholder="110001"
            />
          </div>
        </div>
      </div>

      {/* ========== PRODUCTS SECTION ========== */}
      <div className="form-section">
        <h3>📦 Products <span className="required">*</span></h3>
        <div className="products-container">
          {order.products.map((product, i) => (
            <div key={i} className="product-card">
              <div className="product-header">
                <h4>Product {i + 1}</h4>
                {order.products.length > 1 && (
                  <button 
                    type="button" 
                    className="delete-btn"
                    onClick={() => removeProduct(i)}
                    title="Remove product"
                  >
                    <MdDelete size={20} />
                  </button>
                )}
              </div>

              <div className="product-fields">
                <div className="field-group">
                  <label>Product Name <span className="required">*</span>:</label>
                  <input
                    placeholder="Enter product name"
                    value={product.productName}
                    onChange={(e) => handleProductChange(i, "productName", e.target.value)}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Quantity <span className="required">*</span>:</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={product.quantity}
                    min={1}
                    onChange={(e) => handleProductChange(i, "quantity", e.target.value)}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Category:</label>
                  <select
                    value={product.category}
                    onChange={(e) => handleProductChange(i, "category", e.target.value)}
                  >
                    <option value="Home">Home</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Books">Books</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Price:</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={product.price}
                    onChange={(e) => handleProductChange(i, "price", e.target.value)}
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>

              {/* ✅ NEW: Image Upload for Each Product */}
              <div className="product-images">
                <h4 style={{ marginTop: "12px", marginBottom: "8px" }}>📷 Product Images</h4>
                
                <div className="image-display">
                  {product.imageUrl && (
                    <div className="image-box">
                      <img
                        src={product.imageUrl}
                        alt={`${product.productName} - CSV`}
                        onError={(e) => {
                          e.target.style.display = "none";
                          console.error("Error loading CSV image:", product.imageUrl);
                        }}
                      />
                      <span className="image-label">📊 CSV/Shopify Image</span>
                    </div>
                  )}

                  {product.uploadedImageUrl && (
                    <div className="image-box uploaded">
                      <img
                        src={product.uploadedImageUrl}
                        alt={`${product.productName} - Uploaded`}
                        onError={(e) => console.error("Error loading uploaded image:", product.uploadedImageUrl)}
                      />
                      <span className="image-label">✅ Uploaded Image</span>
                    </div>
                  )}
                </div>

                <div className="file-upload">
                  <label>Upload Product Image:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProductImageUpload(e, i)}
                    disabled={uploadingProductIndex === i}
                    title="Upload image for this product"
                  />
                  {uploadingProductIndex === i && <span className="uploading">⏳ Uploading...</span>}
                  {!product.imageUrl && !product.uploadedImageUrl && (
                    <p className="help-text">No image uploaded yet</p>
                  )}
                  {(product.imageUrl || product.uploadedImageUrl) && (
                    <p className="help-text">✓ Images will be preserved on update</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button 
          className="btn btn-add-product" 
          type="button" 
          onClick={addProduct}
        >
          + Add Another Product
        </button>
      </div>

      {/* ========== SHIPMENT DETAILS SECTION ========== */}
      <div className="form-section">
        <h3>📦 Shipment Details</h3>
        <div className="form-grid">
          <div>
            <label>Dead Weight (kg):</label>
            <input 
              name="deadWeight" 
              type="number" 
              value={order.deadWeight} 
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <label>Length (cm):</label>
            <input 
              name="length" 
              type="number" 
              value={order.length} 
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <label>Breadth (cm):</label>
            <input 
              name="breadth" 
              type="number" 
              value={order.breadth} 
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <label>Height (cm):</label>
            <input 
              name="height" 
              type="number" 
              value={order.height} 
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <label>Volumetric Weight (kg):</label>
            <input 
              name="volumetricWeight" 
              type="number" 
              value={order.volumetricWeight} 
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* ========== ORDER DETAILS SECTION ========== */}
      <div className="form-section">
        <h3>💰 Order Details</h3>
        <div className="form-grid">
          <div>
            <label>Amount:</label>
            <input 
              name="amount" 
              type="number" 
              value={order.amount} 
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <label>Payment Mode:</label>
            <select 
              name="paymentMode" 
              value={order.paymentMode} 
              onChange={handleChange}
            >
              <option value="COD">COD</option>
              <option value="Prepaid">Prepaid</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          <div>
            <label>HSN Code:</label>
            <input 
              name="hsnCode" 
              value={order.hsnCode} 
              onChange={handleChange}
              placeholder="HSN code"
            />
          </div>

          <div>
            <label>Invoice Reference:</label>
            <input 
              name="invoiceReference" 
              value={order.invoiceReference} 
              onChange={handleChange}
              placeholder="Invoice number"
            />
          </div>
        </div>
      </div>

      {/* ========== DESTINATION DETAILS SECTION ========== */}
      <div className="form-section">
        <h3>🏢 Destination (Warehouse) Details</h3>
        <div className="form-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Destination Name:</label>
            <input 
              name="destinationName" 
              value={order.destinationName} 
              onChange={handleChange}
              placeholder="Warehouse name"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label>Address Line 1:</label>
            <textarea 
              name="destinationAddressLine1" 
              value={order.destinationAddressLine1} 
              onChange={handleChange}
              placeholder="Street address"
              rows="2"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label>Address Line 2:</label>
            <input 
              name="destinationAddressLine2" 
              value={order.destinationAddressLine2} 
              onChange={handleChange}
              placeholder="Additional address info"
            />
          </div>

          <div>
            <label>City:</label>
            <input 
              name="destinationCity" 
              value={order.destinationCity} 
              onChange={handleChange}
              placeholder="City"
            />
          </div>

          <div>
            <label>State:</label>
            <input 
              name="destinationState" 
              value={order.destinationState} 
              onChange={handleChange}
              placeholder="State"
            />
          </div>

          <div>
            <label>Pincode:</label>
            <input 
              name="destinationPincode" 
              value={order.destinationPincode} 
              onChange={handleChange}
              placeholder="Pincode"
            />
          </div>

          <div>
            <label>Phone:</label>
            <input 
              name="destinationPhone" 
              value={order.destinationPhone} 
              onChange={handleChange}
              placeholder="Phone number"
            />
          </div>
        </div>
      </div>

      {/* ========== FORM ACTIONS ========== */}
      <div className="form-actions">
        <button 
          type="button" 
          className="btn" 
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="btn"
        >
          {editData ? "✏️ Update Order" : "✨ Create Order"}
        </button>
      </div>
    </form>
  );
}