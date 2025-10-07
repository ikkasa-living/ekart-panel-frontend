import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import ActionMenu from "../ActionMenu/ActionMenu";
import "./OrderTable.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function OrderTable({ orders, onAction, onOrderUpdate, loading = false }) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loadingReturnId, setLoadingReturnId] = useState(null);
  const [localOrders, setLocalOrders] = useState([...orders]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedProductsPerOrder, setSelectedProductsPerOrder] = useState({});
  const menuRef = useRef(null);

  useEffect(() => {
    setLocalOrders([...orders]);
    setSelectedOrderIds([]);
    setSelectedProductsPerOrder({});
  }, [orders]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    }
    function handleEsc(e) {
      if (e.key === "Escape") setMenuOpen(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(localOrders.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedOrders = localOrders.slice(startIdx, startIdx + pageSize);

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrderIds(paginatedOrders.map((o) => o._id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const toggleSelectProduct = (orderId, productIdx) => {
    setSelectedProductsPerOrder(prev => {
      const prevSelected = prev[orderId] || [];
      if (prevSelected.includes(productIdx)) {
        return { ...prev, [orderId]: prevSelected.filter(idx => idx !== productIdx) };
      } else {
        return { ...prev, [orderId]: [...prevSelected, productIdx] };
      }
    });
  };

  const refreshTracking = async (orderId) => {
    try {
      const res = await axios.get(`${API_URL}/api/ekart/tracking/${orderId}`);
      if (res.data.success) {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o.orderId === orderId
              ? { ...o, returnTracking: res.data.tracking }
              : o
          )
        );
        if (onOrderUpdate) {
          onOrderUpdate();
        }
        toast.success("✅ Tracking status updated successfully");
      } else {
        toast.error(res.data.message || "Failed to refresh tracking");
      }
    } catch (err) {
      console.error("Error refreshing tracking:", err);
      toast.error("❌ Error refreshing tracking status");
    }
  };

  const handleFileUpload = async (file, orderId, productIndex) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await axios.post(`${API_URL}/api/ekart/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const photoUrl = uploadRes.data.url;

      setLocalOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order._id === orderId) {
            const updatedProducts = order.products.map((prod, idx) => {
              if (idx === productIndex) {
                return {
                  ...prod,
                  smart_checks: [
                    {
                      item_title: prod.productName,
                      checks: {
                        M_PRODUCT_IMAGE_COLOR_PATTERN_MATCH: {
                          inputs: { item_image: photoUrl },
                          is_mandatory: true,
                        },
                      },
                    },
                  ],
                  uploadedImageUrl: photoUrl,
                };
              }
              return prod;
            });
            return { ...order, products: updatedProducts };
          }
          return order;
        })
      );

      const productName = localOrders.find((o) => o._id === orderId).products[productIndex].productName;
      toast.success(`✅ Photo uploaded for ${productName}`);
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error("❌ Photo upload failed");
    }
  };

  const handleReturnClick = async (order) => {
    setLoadingReturnId(order._id);
    try {
      const selectedProductIndices = selectedProductsPerOrder[order._id] || [];
      if (selectedProductIndices.length === 0) {
        toast.warning("⚠️ Please select at least one product for return");
        setLoadingReturnId(null);
        return;
      }
      const vendorName = order.vendorName || "Ekart";

      const productsToReturn = order.products.filter((_, idx) => selectedProductIndices.includes(idx));

      const payload = {
        shopifyId: order.shopifyId,
        orderId: order.orderId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        products: productsToReturn.map((item) => ({
          ...item,
          smart_checks: item.smart_checks || [],
        })),
        deadWeight: order.deadWeight,
        length: order.length,
        breadth: order.breadth,
        height: order.height,
        volumetricWeight: order.volumetricWeight,
        amount: order.amount,
        paymentMode: order.paymentMode,
        vendorName,
        pickupAddress: order.pickupAddress,
        pickupCity: order.pickupCity,
        pickupState: order.pickupState,
        pickupPincode: order.pickupPincode,
        gstin: order.gstinNumber || "",
        hsn: order.hsnCode || order.hsn || "",
        invoiceId: order.invoiceReference || order.invoiceId || "",
        // Include destination address in payload to match backend schema
        destinationName: order.destinationName || "",
        destinationAddressLine1: order.destinationAddressLine1 || "",
        destinationAddressLine2: order.destinationAddressLine2 || "",
        destinationCity: order.destinationCity || "",
        destinationState: order.destinationState || "",
        destinationPincode: order.destinationPincode || "",
        destinationPhone: order.destinationPhone || "",
      };

      console.log("🚀 Sending return request for order:", order.orderId);

      const response = await axios.post(`${API_URL}/api/ekart/return`, payload);

      if (response.data.success) {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o._id === order._id
              ? {
                  ...o,
                  status: "RETURN_REQUESTED",
                  returnTracking: {
                    currentStatus: "Return Initiated",
                    history: [{
                      status: "Return Initiated",
                      timestamp: new Date(),
                      description: "Return request submitted successfully"
                    }],
                    ekartTrackingId: response.data.trackingId,
                    lastUpdated: new Date()
                  }
                }
              : o
          )
        );
        if (onOrderUpdate) {
          onOrderUpdate();
        }
        toast.success(`✅ Return requested successfully for order ${order.orderId}`);
        setSelectedProductsPerOrder(prev => ({ ...prev, [order._id]: [] }));
      } else {
        toast.error(response.data.message || "Failed to create return request");
        console.error("❌ Return request failed:", response.data);
      }
    } catch (err) {
      console.error("❌ Return request error:", err);
      const errorMessage = err.response?.data?.message || err.message || "Error processing return request";
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setLoadingReturnId(null);
    }
  };

  const handleBulkReturn = async () => {
    if (selectedOrderIds.length === 0) {
      toast.warning("⚠️ Please select orders to return");
      return;
    }

    const confirmMessage = `Are you sure you want to process return requests for ${selectedOrderIds.length} orders?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoadingReturnId("bulk");

    try {
      const ordersToReturn = localOrders.filter((o) => selectedOrderIds.includes(o._id));
      let successCount = 0;
      let errorCount = 0;

      for (const order of ordersToReturn) {
        try {
          const selectedProductIndices = selectedProductsPerOrder[order._id] || [];
          if (selectedProductIndices.length === 0) {
            errorCount++;
            continue;
          }
          const vendorName = order.vendorName || "Ekart";

          const productsToReturn = order.products.filter((_, idx) => selectedProductIndices.includes(idx));

          const payload = {
            shopifyId: order.shopifyId,
            orderId: order.orderId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            customerAddress: order.customerAddress,
            city: order.city,
            state: order.state,
            pincode: order.pincode,
            products: productsToReturn.map((item) => ({
              ...item,
              smart_checks: item.smart_checks || [],
            })),
            deadWeight: order.deadWeight,
            length: order.length,
            breadth: order.breadth,
            height: order.height,
            volumetricWeight: order.volumetricWeight,
            amount: order.amount,
            paymentMode: order.paymentMode,
            vendorName,
            pickupAddress: order.pickupAddress,
            pickupCity: order.pickupCity,
            pickupState: order.pickupState,
            pickupPincode: order.pickupPincode,
            gstin: order.gstinNumber || "",
            hsn: order.hsnCode || order.hsn || "",
            invoiceId: order.invoiceReference || order.invoiceId || "",
            destinationName: order.destinationName || "",
            destinationAddressLine1: order.destinationAddressLine1 || "",
            destinationAddressLine2: order.destinationAddressLine2 || "",
            destinationCity: order.destinationCity || "",
            destinationState: order.destinationState || "",
            destinationPincode: order.destinationPincode || "",
            destinationPhone: order.destinationPhone || "",
          };

          const response = await axios.post(`${API_URL}/api/ekart/return`, payload);

          if (response.data.success) {
            setLocalOrders((prev) =>
              prev.map((o) =>
                o._id === order._id
                  ? {
                      ...o,
                      status: "RETURN_REQUESTED",
                      returnTracking: {
                        currentStatus: "Return Initiated",
                        history: [{
                          status: "Return Initiated",
                          timestamp: new Date(),
                          description: "Bulk return request submitted"
                        }],
                        ekartTrackingId: response.data.trackingId,
                        lastUpdated: new Date()
                      }
                    }
                  : o
              )
            );
            successCount++;
            setSelectedProductsPerOrder(prev => ({ ...prev, [order._id]: [] }));
          } else {
            errorCount++;
            console.error("❌ Bulk return failed for order:", order.orderId, response.data);
          }
        } catch (orderError) {
          errorCount++;
          console.error("❌ Error processing return for order:", order.orderId, orderError);
        }
      }

      if (onOrderUpdate) {
        onOrderUpdate();
      }

      setSelectedOrderIds([]);

      if (successCount > 0) {
        toast.success(`✅ Successfully processed ${successCount} return requests`);
      }
      if (errorCount > 0) {
        toast.error(`❌ Failed to process ${errorCount} return requests (No products selected or error)`);
      }
    } catch (err) {
      console.error("❌ Bulk return error:", err);
      toast.error("❌ Bulk return operation failed");
    } finally {
      setLoadingReturnId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>⏳ Loading orders...</p>
      </div>
    );
  }

  if (localOrders.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>📦 No orders found</p>
        <p style={{ color: "#666", fontSize: "14px" }}>
          Try adjusting your search criteria or sync orders from Shopify
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          className="btn bulk-return-btn"
          onClick={handleBulkReturn}
          disabled={selectedOrderIds.length === 0 || loadingReturnId === "bulk"}
          style={{
            backgroundColor: selectedOrderIds.length > 0 ? "#dc2626" : "#9ca3af",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: selectedOrderIds.length > 0 ? "pointer" : "not-allowed"
          }}
        >
          {loadingReturnId === "bulk" ? "⏳ Processing..." : `🔄 Return Selected Orders (${selectedOrderIds.length})`}
        </button>
        {selectedOrderIds.length > 0 && (
          <span style={{ color: "#666", fontSize: "14px" }}>
            {selectedOrderIds.length} orders selected
          </span>
        )}
      </div>

      <div className="table-container">
        <table className="order-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  checked={
                    selectedOrderIds.length > 0 &&
                    selectedOrderIds.length === paginatedOrders.length
                  }
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  aria-label="Select all orders on page"
                />
              </th>
              <th>AWB</th>
              <th>Order Number</th>
              <th>Date</th>
              <th>Customer Details</th>
              <th>Product Details</th>
              <th>Package Details</th>
              <th>Payment</th>
              <th>Payment Method</th>
              <th>Pickup Address</th>
              <th>Pickup City</th>
              <th>Pickup State</th>
              <th>Pickup Pincode</th>
              {/* New Warehouse Address column */}
              <th>Destination Address</th>
              <th>GSTIN Number</th>
              <th>HSN Code</th>
              <th>Invoice Reference</th>
              <th>Return Label 1</th>
              <th>Return Label 2</th>
              <th>Service Tier</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Status & Tracking</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...new Map(paginatedOrders.map((o) => [o.orderId, o])).values()].map((order) => (
              <tr key={order._id} className={selectedOrderIds.includes(order._id) ? "selected" : ""}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(order._id)}
                    onChange={() => toggleSelectOrder(order._id)}
                    aria-label={`Select order ${order.orderId}`}
                  />
                </td>
                <td>{order.awb || "-"}</td>
                <td>
                <strong>
                    {order.orderId.startsWith("#") ? order.orderId : `#${order.orderId}`}
                </strong>
                </td>

                <td>{formatDate(order.orderDate)}</td>
                <td>
                  <div className="customer-details">
                    <div><strong>{order.customerName}</strong></div>
                    <div>{order.customerPhone}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{order.customerEmail}</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>{order.customerAddress}</div>
                  </div>
                </td>
                <td>
                  <div className="products-cell">
                    {order.products?.map((p, i) => (
                      <div key={i} className="product-item" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="checkbox"
                          checked={selectedProductsPerOrder[order._id]?.includes(i) || false}
                          onChange={() => toggleSelectProduct(order._id, i)}
                          aria-label={`Select product ${p.productName} for return`}
                        />
                        <div className="product-info">
                          <strong>{p.productName}</strong> <span className="qty">(Qty: {p.quantity})</span>
                        </div>
                        {p.imageUrl && (
                          <div className="product-image-container">
                            <img
                              src={`${API_URL}${p.imageUrl}`}
                              alt={p.productName}
                              className="csv-product-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                console.error('Error loading CSV image:', p.imageUrl);
                              }}
                            />
                            <span className="image-source">From CSV</span>
                          </div>
                        )}
                        <div className="product-upload">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                handleFileUpload(file, order._id, i);
                              }
                            }}
                            style={{ fontSize: "12px" }}
                          />
                          {p.previewImage && (
                            <div className="manual-image-container">
                              <img
                                src={p.previewImage}
                                alt="Preview"
                                className="uploaded-image"
                                style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "4px" }}
                              />
                              <span className="image-source">Preview</span>
                            </div>
                          )}
                          {p.smart_checks?.[0]?.checks?.M_PRODUCT_IMAGE_COLOR_PATTERN_MATCH?.inputs?.item_image && (
                            <div className="manual-image-container">
                              <img
                                src={p.smart_checks[0].checks.M_PRODUCT_IMAGE_COLOR_PATTERN_MATCH.inputs.item_image}
                                alt="Manual upload"
                                className="uploaded-image"
                                style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "4px" }}
                              />
                              <span className="image-source">Uploaded</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="package-details">
                    <div><strong>Weight:</strong> {order.deadWeight} kg</div>
                    <div><strong>Dimensions:</strong></div>
                    <div>{order.length} × {order.breadth} × {order.height} cm</div>
                    <div><strong>Vol. Weight:</strong> {order.volumetricWeight} kg</div>
                  </div>
                </td>
                <td>
                  <strong>₹{order.amount}</strong>
                </td>
                <td>{order.paymentMode}</td>
                <td>
                  <div>
                    <div><strong>{order.vendorName}</strong></div>
                    <div style={{ fontSize: "12px" }}>{order.pickupAddress}</div>
                  </div>
                </td>
                <td>{order.pickupCity || "-"}</td>
                <td>{order.pickupState || "-"}</td>
                <td>{order.pickupPincode || "-"}</td>

                {/* Warehouse Address Column */}
                <td>
                  <div style={{ fontSize: "12px", lineHeight: "1.3" }}>
                    <strong>{order.destinationName || "-"}</strong><br />
                    {order.destinationAddressLine1 || "-"}<br />
                    {order.destinationAddressLine2 ? <>{order.destinationAddressLine2}<br /></> : null}
                    {order.destinationCity || "-"}, {order.destinationState || "-"}<br />
                    {order.destinationPincode || "-"}<br />
                    {order.destinationPhone || "-"}
                  </div>
                </td>

                <td>{order.gstinNumber || "-"}</td>
                <td>{order.hsnCode || order.hsn || "-"}</td>
                <td>{order.invoiceReference || order.invoiceId || "-"}</td>
                <td>{order.returnLabel1 || "-"}</td>
                <td>{order.returnLabel2 || "-"}</td>
                <td>{order.serviceTier || "-"}</td>
                <td>{order.category || "-"}</td>
                <td>{order.unitPrice ? `₹${order.unitPrice}` : "-"}</td>

                <td className="status-tracking-cell">
                  <div className="status-info">
                    <span className={`status-badge status-${order.status?.toLowerCase().replace('_', '-') || 'new'}`}>
                      {order.status || "New"}
                    </span>
                    {order.returnTracking?.ekartTrackingId && (
                      <div className="tracking-info">
                        <div className="tracking-id">
                          <strong>Tracking:</strong> {order.returnTracking.ekartTrackingId}
                        </div>
                        <div className="current-status">
                          <strong>Current:</strong> {order.returnTracking.currentStatus}
                        </div>
                        {order.returnTracking.history && order.returnTracking.history.length > 0 && (
                          <details className="tracking-history">
                            <summary>History ({order.returnTracking.history.length})</summary>
                            <div className="history-list">
                              {order.returnTracking.history.map((h, i) => (
                                <div key={i} className="history-item">
                                  <div className="history-status">{h.status}</div>
                                  <div className="history-time">{formatDateTime(h.timestamp)}</div>
                                  {h.description && (
                                    <div className="history-desc">{h.description}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        <button
                          onClick={() => refreshTracking(order.orderId)}
                          className="btn btn-sm refresh-btn"
                          title="Refresh tracking status"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                    )}
                  </div>
                </td>

                <td className="action-cell">
                  <div className="action-buttons">
                    <button
                      className={`btn return-btn ${order.status === 'RETURN_REQUESTED' ? 'disabled' : ''}`}
                      onClick={() => handleReturnClick(order)}
                      disabled={loadingReturnId === order._id || order.status === 'RETURN_REQUESTED'}
                      title={order.status === 'RETURN_REQUESTED' ? 'Return already requested' : 'Request return'}
                    >
                      {loadingReturnId === order._id ? "⏳" : order.status === 'RETURN_REQUESTED' ? "✅ Returned" : "🔄 Return"}
                    </button>
                    <button
                      className="btn btn-menu"
                      onClick={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        setMenuOpen({
                          id: order._id,
                          top: rect.bottom,
                          left: rect.left,
                        });
                      }}
                      title="More actions"
                    >
                      ⋮
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-controls">
        <div className="pagination-buttons">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            ⏮ First
          </button>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            ◀ Prev
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next ▶
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            Last ⏭
          </button>
        </div>
        <div className="page-size-selector">
          <label htmlFor="page-size">Show:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuOpen.top,
            left: menuOpen.left,
            zIndex: 2000,
          }}
        >
          <ActionMenu
            order={localOrders.find((o) => o._id === menuOpen.id)}
            onAction={onAction}
          />
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </>
  );
}
