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
  const [selectedReturnQuantities, setSelectedReturnQuantities] = useState({});
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

  const updateReturnQuantity = (orderId, productIdx, quantity) => {
    setSelectedReturnQuantities((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [productIdx]: quantity,
      },
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sortedOrders = [...localOrders];
  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedOrders = sortedOrders.slice(startIdx, startIdx + pageSize);

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
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
    setSelectedProductsPerOrder((prev) => {
      const prevSelected = prev[orderId] || [];
      if (prevSelected.includes(productIdx)) {
        return { ...prev, [orderId]: prevSelected.filter((idx) => idx !== productIdx) };
      } else {
        return { ...prev, [orderId]: [...prevSelected, productIdx] };
      }
    });
  };

  // ✅ FIXED: refreshTracking - Preserves order status and tracking info
  const refreshTracking = async (orderId) => {
    try {
      console.log("🔄 Refreshing tracking for orderId:", orderId);

      // ✅ Find the order to ensure it exists
      const orderToRefresh = localOrders.find(o => o.orderId === orderId);
      if (!orderToRefresh) {
        toast.error("❌ Order not found");
        return;
      }

      // ✅ Show loading state
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? { ...o, trackingLoading: true }
            : o
        )
      );

      console.log("📡 Fetching tracking from API for:", orderId);

      // ✅ Call tracking endpoint
      const res = await axios.get(`${API_URL}/api/ekart/track/${orderId}`);

      console.log("📦 Tracking response received:", res.data);

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to fetch tracking");
      }

      // ✅ CRITICAL FIX: Only update tracking info, preserve entire order
      const updatedTrackingData = res.data.order?.returnTracking || res.data.tracking;
      const preservedOrder = localOrders.find(o => o.orderId === orderId);

      console.log("✅ Update info:", {
        orderId,
        currentTrackingStatus: updatedTrackingData?.currentStatus,
        preservedOrderStatus: preservedOrder?.status, // ✅ Should be RETURN_REQUESTED
      });

      setLocalOrders((prev) =>
        prev.map((o) => {
          if (o.orderId === orderId) {
            return {
              ...o,  // ✅ KEEP all existing data
              returnTracking: updatedTrackingData,  // ✅ ONLY update tracking
              // ✅ IMPORTANT: NOT changing status, it stays as is
              trackingLoading: false,
              updatedAt: new Date().toISOString(),
            };
          }
          return o;
        })
      );

      // ✅ Verify update
      const updatedOrderAfter = localOrders.find(o => o.orderId === orderId);
      console.log("✅ Order after update:", {
        orderId,
        status: updatedOrderAfter?.status,  // Should still be RETURN_REQUESTED
        trackingId: updatedOrderAfter?.returnTracking?.ekartTrackingId,
        currentStatus: updatedOrderAfter?.returnTracking?.currentStatus,
      });

      toast.success("✅ Tracking status updated successfully", { autoClose: 3000 });

    } catch (err) {
      console.error("❌ Error refreshing tracking:", err);

      const errorMsg =
        err.response?.data?.message || err.message || "Error refreshing tracking";

      console.error("❌ Error details:", {
        message: errorMsg,
        response: err.response?.data,
      });

      toast.error(`❌ ${errorMsg}`, { autoClose: 3000 });

      // ✅ Reset loading state on error
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? { ...o, trackingLoading: false }
            : o
        )
      );
    }
  };

  // ✅ Bulk tracking refresh
  const handleBulkTrackingRefresh = async () => {
    const ordersWithTracking = localOrders.filter(
      (order) =>
        order.returnTracking?.ekartTrackingId && selectedOrderIds.includes(order._id)
    );

    if (ordersWithTracking.length === 0) {
      toast.warning("⚠️ No orders with tracking IDs selected");
      return;
    }

    try {
      setLoadingReturnId("bulk-tracking");
      const trackingIds = ordersWithTracking.map(
        (order) => order.returnTracking.ekartTrackingId
      );

      const response = await axios.post(`${API_URL}/api/ekart/track/bulk`, {
        trackingIds: trackingIds,
      });

      if (response.data.success) {
        const trackingData = response.data.trackingData;

        setLocalOrders((prev) =>
          prev.map((order) => {
            if (
              order.returnTracking?.ekartTrackingId &&
              trackingData[order.returnTracking.ekartTrackingId]
            ) {
              const shipmentData = trackingData[order.returnTracking.ekartTrackingId];
              const latestHistory = shipmentData.history?.[0];

              return {
                ...order,
                returnTracking: {
                  ...order.returnTracking,
                  currentStatus: latestHistory?.status || order.returnTracking.currentStatus,
                  lastUpdated: new Date().toISOString(),
                  fullTrackingData: shipmentData,
                  history: [
                    ...(order.returnTracking.history || []),
                    {
                      status: latestHistory?.status || "Updated",
                      timestamp: new Date().toISOString(),
                      description: latestHistory?.public_description || "Bulk tracking update",
                      city: latestHistory?.city,
                      hubName: latestHistory?.hub_name,
                    },
                  ],
                },
              };
            }
            return order;
          })
        );

        toast.success(`✅ Tracking updated for ${ordersWithTracking.length} orders`, {
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("❌ Bulk tracking error:", error);
      toast.error("❌ Bulk tracking update failed", { autoClose: 3000 });
    } finally {
      setLoadingReturnId(null);
    }
  };

  // ✅ Image upload handler
  const handleFileUpload = async (file, orderId, productIndex) => {
    try {
      const previewUrl = URL.createObjectURL(file);
      setLocalOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order._id === orderId) {
            const updatedProducts = order.products.map((prod, idx) => {
              if (idx === productIndex) {
                return { ...prod, previewImage: previewUrl };
              }
              return prod;
            });
            return { ...order, products: updatedProducts };
          }
          return order;
        })
      );

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
                  previewImage: previewUrl,
                };
              }
              return prod;
            });
            return { ...order, products: updatedProducts };
          }
          return order;
        })
      );

      const productName = localOrders.find((o) => o._id === orderId).products[
        productIndex
      ].productName;
      toast.success(`✅ Photo uploaded for ${productName}`, { autoClose: 3000 });
    } catch (err) {
      console.error("❌ Photo upload error:", err);
      toast.error("❌ Photo upload failed", { autoClose: 3000 });
    }
  };

  // ✅ FIXED: Complete handleReturnClick with proper error handling and state management
  const handleReturnClick = async (order) => {
    console.log("🚀 Return clicked for order:", order.orderId);
    setLoadingReturnId(order._id);

    try {
      const selectedProductIndices = selectedProductsPerOrder[order._id] || [];

      if (selectedProductIndices.length === 0) {
        toast.warning("⚠️ Please select at least one product for return");
        setLoadingReturnId(null);
        return;
      }

      const productsToReturn = order.products
        .filter((_, idx) => selectedProductIndices.includes(idx))
        .map((item, idx) => ({
          ...item,
          quantity: selectedReturnQuantities[order._id]?.[idx] || item.quantity || 1,
          smart_checks: item.smart_checks || [],
          uploadedImageUrl: item.uploadedImageUrl || "",
        }));

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
        products: productsToReturn,
        deadWeight: order.deadWeight,
        length: order.length,
        breadth: order.breadth,
        height: order.height,
        volumetricWeight: order.volumetricWeight,
        amount: order.amount,
        paymentMode: order.paymentMode,
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

      console.log("📤 Sending return payload:", payload);

      // ✅ CRITICAL: Make the API call
      const response = await axios.post(`${API_URL}/api/ekart/return`, payload);

      console.log("📨 Return response received:", response.data);

      // ✅ FIXED: Check response.data.success NOT just response.status
      if (!response.data || !response.data.success) {
        const errorMsg =
          response.data?.message ||
          response.data?.details?.message ||
          "Unknown error occurred";
        console.error("❌ Return request failed:", response.data);
        toast.error(`❌ Return failed: ${errorMsg}`, { autoClose: 5000 });
        setLoadingReturnId(null);
        return;
      }

      // ✅ FIXED: Extract ALL data from backend response
      const trackingId = response.data.trackingId;
      const updatedOrderFromBackend = response.data.order;
      const newStatus = response.data.orderStatus || updatedOrderFromBackend?.status;

      console.log("✅ Backend returned:");
      console.log("   - Tracking ID:", trackingId);
      console.log("   - Order Status:", newStatus);
      console.log("   - Full Updated Order:", updatedOrderFromBackend);

      if (!updatedOrderFromBackend) {
        console.error("❌ ERROR: Backend did not return updated order object!");
        throw new Error("Backend response missing updated order data");
      }

      // ✅ FIXED: Update local state IMMEDIATELY with the backend response
      setLocalOrders((prev) =>
        prev.map((o) => {
          if (o._id === order._id) {
            // Use the FULL updated order from backend
            const newOrderState = {
              ...updatedOrderFromBackend,
              status: newStatus,
              trackingLoading: false,
              updatedAt: new Date().toISOString(),
            };
            console.log("✅ Updating local state for order:", o._id, "New Status:", newStatus);
            return newOrderState;
          }
          return o;
        })
      );

      // ✅ Clear product selections immediately
      setSelectedProductsPerOrder((prev) => {
        const updated = { ...prev };
        delete updated[order._id];
        return updated;
      });

      // ✅ FIXED: Show success toast with all details
      toast.success(
        `✅ Return Successfully Created!\nOrder: ${order.orderId}\nTracking ID: ${trackingId}\nStatus: ${newStatus}`,
        { autoClose: 5000 }
      );

      console.log("✅ Local state updated, UI should now show RETURN_REQUESTED status");

      // ✅ OPTIONAL: Refetch after delay to ensure backend sync
      setTimeout(() => {
        console.log("🔄 Refetching all orders to sync with backend...");
        if (onOrderUpdate) {
          onOrderUpdate();
        }
      }, 1000);
    } catch (err) {
      console.error("❌ Return request error:", err);
      console.error("❌ Full error object:", err.response?.data || err);

      // ✅ FIXED: Better error extraction
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.details?.message ||
        err.response?.data?.error ||
        err.message ||
        "Error processing return request";

      console.error("❌ Final error message:", errorMessage);

      toast.error(`❌ Return Failed:\n${errorMessage}`, { autoClose: 5000 });
    } finally {
      setLoadingReturnId(null);
    }
  };

  // ✅ Bulk return handler
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

          const productsToReturn = order.products.filter((_, idx) =>
            selectedProductIndices.includes(idx)
          );

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
            const updatedOrderFromBackend = response.data.order;

            setLocalOrders((prev) =>
              prev.map((o) =>
                o._id === order._id ? { ...updatedOrderFromBackend, trackingLoading: false } : o
              )
            );

            successCount++;
            setSelectedProductsPerOrder((prev) => {
              const updated = { ...prev };
              delete updated[order._id];
              return updated;
            });
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
        toast.success(`✅ Successfully processed ${successCount} return requests`, {
          autoClose: 5000,
        });
      }
      if (errorCount > 0) {
        toast.error(
          `❌ Failed to process ${errorCount} return requests (No products selected or error)`,
          { autoClose: 5000 }
        );
      }
    } catch (err) {
      console.error("❌ Bulk return error:", err);
      toast.error("❌ Bulk return operation failed", { autoClose: 5000 });
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
      {/* Bulk Actions */}
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
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
            cursor: selectedOrderIds.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          {loadingReturnId === "bulk"
            ? "⏳ Processing..."
            : `🔄 Return Selected Orders (${selectedOrderIds.length})`}
        </button>

        <button
          className="btn bulk-tracking-btn"
          onClick={handleBulkTrackingRefresh}
          disabled={selectedOrderIds.length === 0 || loadingReturnId === "bulk-tracking"}
          style={{
            backgroundColor: selectedOrderIds.length > 0 ? "#059669" : "#9ca3af",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: selectedOrderIds.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          {loadingReturnId === "bulk-tracking"
            ? "⏳ Updating..."
            : `📍 Refresh Tracking (${selectedOrderIds.length})`}
        </button>

        {selectedOrderIds.length > 0 && (
          <span style={{ color: "#666", fontSize: "14px" }}>
            {selectedOrderIds.length} orders selected
          </span>
        )}
      </div>

      {/* Table Container */}
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
              <th>Order Number</th>
              <th>Date</th>
              <th>Customer Details</th>
              <th>Product Details</th>
              <th>Package Details</th>
              <th>Payment</th>
              <th>Payment Method</th>
              <th>Destination Address</th>
              <th>HSN Code</th>
              <th>Invoice Reference</th>
              <th>Service Tier</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Status & Tracking</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...new Map(paginatedOrders.map((o) => [o.orderId, o])).values()].map(
              (order) => (
                <tr
                  key={order._id}
                  className={selectedOrderIds.includes(order._id) ? "selected" : ""}
                >
                  {/* Checkbox */}
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order._id)}
                      onChange={() => toggleSelectOrder(order._id)}
                      aria-label={`Select order ${order.orderId}`}
                    />
                  </td>

                  {/* Order Number */}
                  <td>
                    <strong>{order.orderId.startsWith("#") ? order.orderId : `#${order.orderId}`}</strong>
                  </td>

                  {/* Date */}
                  <td>{formatDate(order.orderDate)}</td>

                  {/* Customer Details */}
                  <td>
                    <div className="customer-details">
                      <div>
                        <strong>{order.customerName}</strong>
                      </div>
                      <div>{order.customerPhone}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {order.customerEmail}
                      </div>
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>
                        {order.customerAddress}
                      </div>
                    </div>
                  </td>

                  {/* Product Details */}
                  <td>
                    <div className="products-cell">
                      {order.products?.map((p, i) => (
                        <div
                          key={i}
                          className="product-item"
                          style={{ display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProductsPerOrder[order._id]?.includes(i) || false}
                            onChange={() => toggleSelectProduct(order._id, i)}
                            aria-label={`Select product ${p.productName} for return`}
                          />
                          <div className="product-info">
                            <strong>{p.productName}</strong> <span className="qty">(Qty: {p.quantity})</span>
                            {p.quantity > 1 && (
                              <select
                                value={selectedReturnQuantities[order._id]?.[i] || 1}
                                onChange={(e) =>
                                  updateReturnQuantity(order._id, i, Number(e.target.value))
                                }
                                aria-label={`Select quantity to return for ${p.productName}`}
                                style={{ marginLeft: "8px" }}
                              >
                                {Array.from({ length: p.quantity }, (_, idx) => idx + 1).map(
                                  (num) => (
                                    <option key={num} value={num}>
                                      {num}
                                    </option>
                                  )
                                )}
                              </select>
                            )}
                          </div>
                          {p.imageUrl && (
                            <div className="product-image-container">
                              <img
                                src={p.imageUrl}
                                alt={p.productName}
                                style={{
                                  width: "60px",
                                  height: "60px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                }}
                                className="csv-product-image"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  console.error("Error loading CSV image:", p.imageUrl);
                                }}
                              />
                            </div>
                          )}
                          <div className="product-upload">
                            {p.previewImage && (
                              <div className="manual-image-container">
                                <img
                                  src={p.previewImage}
                                  alt="Preview"
                                  className="uploaded-image"
                                  style={{
                                    width: "60px",
                                    height: "60px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                  }}
                                />
                                <span className="image-source">Preview</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileUpload(e.target.files[0], order._id, i);
                                }
                              }}
                              style={{ fontSize: "11px" }}
                              aria-label={`Upload image for ${p.productName}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Package Details */}
                  <td>
                    <div className="package-details">
                      <div>
                        <strong>Weight:</strong> {order.deadWeight} kg
                      </div>
                      <div>
                        <strong>Dimensions:</strong>
                      </div>
                      <div>
                        {order.length} × {order.breadth} × {order.height} cm
                      </div>
                      <div>
                        <strong>Vol. Weight:</strong> {order.volumetricWeight} kg
                      </div>
                    </div>
                  </td>

                  {/* Payment */}
                  <td>
                    <strong>₹{order.amount}</strong>
                  </td>

                  {/* Payment Method */}
                  <td>{order.paymentMode}</td>

                  {/* Destination Address */}
                  <td>
                    <div style={{ fontSize: "12px", lineHeight: "1.3" }}>
                      <strong>{order.destinationName || "-"}</strong>
                      <br />
                      {order.destinationAddressLine1 || "-"}
                      <br />
                      {order.destinationAddressLine2 ? (
                        <>
                          {order.destinationAddressLine2}
                          <br />
                        </>
                      ) : null}
                      {order.destinationCity || "-"}, {order.destinationState || "-"}
                      <br />
                      {order.destinationPincode || "-"}
                      <br />
                      {order.destinationPhone || "-"}
                    </div>
                  </td>

                  {/* HSN Code */}
                  <td>{order.hsnCode || order.hsn || "-"}</td>

                  {/* Invoice Reference */}
                  <td>{order.invoiceReference || order.invoiceId || "-"}</td>

                  {/* Service Tier */}
                  <td>{order.serviceTier || "-"}</td>

                  {/* Category */}
                  <td>{order.category || "-"}</td>

                  {/* Unit Price */}
                  <td>{order.unitPrice ? `₹${order.unitPrice}` : "-"}</td>

                  {/* Status & Tracking */}
                  <td className="status-tracking-cell">
                    <div className="status-info">
                      <span
                        className={`status-badge status-${(order.status || "new")
                          .toLowerCase()
                          .replace("_", "-")}`}
                      >
                        {order.status || "New"}
                      </span>

                      {order.returnTracking?.ekartTrackingId && (
                        <div className="tracking-info">
                          <div className="tracking-id">
                            <strong>Tracking:</strong>
                            <code
                              style={{
                                fontSize: "11px",
                                backgroundColor: "#f3f4f6",
                                padding: "1px 4px",
                                borderRadius: "3px",
                              }}
                            >
                              {order.returnTracking.ekartTrackingId}
                            </code>
                          </div>
                          <div className="current-status">
                            <strong>Status:</strong>
                            <span
                              className={`tracking-status status-${(
                                order.returnTracking.currentStatus || ""
                              )
                                .toLowerCase()
                                .replace(/_/g, "-")}`}
                            >
                              {order.returnTracking.currentStatus}
                            </span>
                          </div>
                          {order.returnTracking.lastUpdated && (
                            <div className="last-updated" style={{ fontSize: "11px", color: "#666" }}>
                              Updated: {formatDateTime(order.returnTracking.lastUpdated)}
                            </div>
                          )}
                          {order.returnTracking.history && order.returnTracking.history.length > 0 && (
                            <details className="tracking-history">
                              <summary>History ({order.returnTracking.history.length})</summary>
                              <div className="history-list">
                                {order.returnTracking.history.slice(0, 5).map((h, i) => (
                                  <div key={i} className="history-item">
                                    <div className="history-status">{h.status}</div>
                                    <div className="history-time">{formatDateTime(h.timestamp)}</div>
                                    {h.city && <div className="history-city">📍 {h.city}</div>}
                                    {h.description && (
                                      <div className="history-desc">{h.description}</div>
                                    )}
                                  </div>
                                ))}
                                {order.returnTracking.history.length > 5 && (
                                  <div className="more-history">
                                    ... and {order.returnTracking.history.length - 5} more
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="action-cell">
                    <div className="action-buttons">
                      <button
                        className={`btn return-btn ${order.status === "RETURN_REQUESTED" ? "disabled" : ""}`}
                        onClick={() => handleReturnClick(order)}
                        disabled={loadingReturnId === order._id || order.status === "RETURN_REQUESTED"}
                        title={
                          order.status === "RETURN_REQUESTED"
                            ? "Return already requested"
                            : "Request return"
                        }
                      >
                        {loadingReturnId === order._id
                          ? "⏳"
                          : order.status === "RETURN_REQUESTED"
                            ? "✅ Returned"
                            : "🔄 Return"}
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
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {/* Action Menu */}
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