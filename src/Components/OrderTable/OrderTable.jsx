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

  const refreshTracking = async (orderId) => {
    try {
      const orderToRefresh = localOrders.find((o) => o.orderId === orderId);
      if (!orderToRefresh) {
        toast.error("❌ Order not found");
        return;
      }

      setLocalOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, trackingLoading: true } : o
        )
      );

      const res = await axios.get(`${API_URL}/api/ekart/track/${orderId}`);

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to fetch tracking");
      }

      const updatedTrackingData = res.data.order?.returnTracking || res.data.tracking;

      setLocalOrders((prev) =>
        prev.map((o) => {
          if (o.orderId === orderId) {
            return {
              ...o,
              returnTracking: updatedTrackingData,
              trackingLoading: false,
              updatedAt: new Date().toISOString(),
            };
          }
          return o;
        })
      );

      toast.success("✅ Tracking status updated successfully", { autoClose: 3000 });
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || "Error refreshing tracking";
      toast.error(`❌ ${errorMsg}`, { autoClose: 3000 });

      setLocalOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, trackingLoading: false } : o
        )
      );
    }
  };

  const handleRetryPickup = async (order) => {
    if (!order.returnTracking?.ekartTrackingId) {
      toast.warning("⚠️ No previous return attempt found");
      return;
    }

    if (order.returnTracking?.currentStatus !== "Reverse pickup cancelled") {
      toast.warning(
        `⚠️ Can only retry cancelled pickups. Current status: ${order.returnTracking?.currentStatus}`
      );
      return;
    }

    setLoadingReturnId(`retry-${order._id}`);

    try {
      const resetResponse = await axios.post(`${API_URL}/api/ekart/retry-failed-return`, {
        orderId: order.orderId,
      });

      if (!resetResponse.data.success) {
        throw new Error(resetResponse.data.message);
      }

      const rescheduleResponse = await axios.post(`${API_URL}/api/ekart/reschedule-pickup`, {
        orderId: order.orderId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        products: order.products || [],
        deadWeight: order.deadWeight,
        length: order.length,
        breadth: order.breadth,
        height: order.height,
        volumetricWeight: order.volumetricWeight,
        amount: order.amount,
        paymentMode: order.paymentMode,
        hsnCode: order.hsnCode || order.hsn,
        invoiceReference: order.invoiceReference,
        destinationName: order.destinationName || "Ikkasa Warehouse",
        destinationAddressLine1: order.destinationAddressLine1 || "",
        destinationAddressLine2: order.destinationAddressLine2 || "",
        destinationCity: order.destinationCity || "",
        destinationState: order.destinationState || "",
        destinationPincode: order.destinationPincode || "",
        destinationPhone: order.destinationPhone || "",
      });

      if (!rescheduleResponse.data.success) {
        throw new Error(rescheduleResponse.data.message);
      }

      const newTrackingId = rescheduleResponse.data.trackingId;
      const updatedOrder = rescheduleResponse.data.order;

      setLocalOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? {
                ...updatedOrder,
                trackingLoading: false,
                updatedAt: new Date().toISOString(),
              }
            : o
        )
      );

      toast.success(
        `✅ Pickup Rescheduled!\nNew Tracking ID: ${newTrackingId}\nEkart will contact customer for new pickup slot`,
        { autoClose: 6000 }
      );
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || "Failed to reschedule pickup";
      toast.error(`❌ Reschedule Failed:\n${errorMsg}`, { autoClose: 5000 });
    } finally {
      setLoadingReturnId(null);
    }
  };

  const shouldShowRetryButton = (order) => {
    return order.returnTracking?.currentStatus === "Reverse pickup cancelled";
  };

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
      toast.error("❌ Bulk tracking update failed", { autoClose: 3000 });
    } finally {
      setLoadingReturnId(null);
    }
  };

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
      toast.error("❌ Photo upload failed", { autoClose: 3000 });
    }
  };

  // ✅ FIXED: handleReturnClick with multiple shipments support and always clickable return button
  const handleReturnClick = async (order) => {
    setLoadingReturnId(order._id);

    try {
      const selectedProductIndices = selectedProductsPerOrder[order._id] || [];

      if (selectedProductIndices.length === 0) {
        toast.warning("⚠️ Please select at least one product for return");
        setLoadingReturnId(null);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let totalShipmentsCreated = 0;

      // ✅ NEW: Loop through selected products and create return for EACH quantity
      for (const productIdx of selectedProductIndices) {
        const item = order.products[productIdx];
        const selectedQty = selectedReturnQuantities[order._id]?.[productIdx] || 1;

        // ✅ Create a return request for EACH item (quantity = 1 each time for Ekart)
        for (let i = 0; i < selectedQty; i++) {
          const productsToReturn = [{
            ...item,
            quantity: 1, // ✅ Always 1 per Ekart shipment
            smart_checks: item.smart_checks || [],
            uploadedImageUrl: item.uploadedImageUrl || "",
            imageUrl: item.imageUrl || "",
          }];

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
            hsnCode: order.hsnCode || order.hsn || "",
            invoiceReference: order.invoiceReference || order.invoiceId || "",
            destinationName: order.destinationName || "",
            destinationAddressLine1: order.destinationAddressLine1 || "",
            destinationAddressLine2: order.destinationAddressLine2 || "",
            destinationCity: order.destinationCity || "",
            destinationState: order.destinationState || "",
            destinationPincode: order.destinationPincode || "",
            destinationPhone: order.destinationPhone || "",
          };

          try {
            const response = await axios.post(`${API_URL}/api/ekart/return`, payload);

            if (response.data?.success) {
              successCount++;
              totalShipmentsCreated++;
              console.log(`✅ Return ${i + 1}/${selectedQty} created for ${item.productName}`);
            } else {
              errorCount++;
              console.error(`❌ Return ${i + 1}/${selectedQty} failed for ${item.productName}`);
            }
          } catch (itemError) {
            errorCount++;
            console.error(
              `❌ Return ${i + 1}/${selectedQty} error for ${item.productName}:`,
              itemError.response?.data?.message || itemError.message
            );
          }
        }
      }

      // Update order if ANY shipment succeeded
      if (successCount > 0) {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o._id === order._id
              ? {
                  ...o,
                  status: "RETURN_REQUESTED",
                  trackingLoading: false,
                  updatedAt: new Date().toISOString(),
                }
              : o
          )
        );

        setSelectedProductsPerOrder((prev) => {
          const updated = { ...prev };
          delete updated[order._id];
          return updated;
        });

        // ✅ Clear quantities after successful return
        setSelectedReturnQuantities((prev) => {
          const updated = { ...prev };
          delete updated[order._id];
          return updated;
        });

        toast.success(
          `✅ Created ${totalShipmentsCreated} return shipment(s) for ${order.orderId}!`,
          { autoClose: 5000 }
        );
      }

      // Show error if some failed
      if (errorCount > 0) {
        if (successCount > 0) {
          toast.warning(
            `⚠️ Created ${successCount} returns, but ${errorCount} failed. You can retry.`,
            { autoClose: 5000 }
          );
        } else {
          toast.error(
            `❌ All ${errorCount} return attempts failed. Please try again.`,
            { autoClose: 5000 }
          );
        }
      }

      setTimeout(() => {
        if (onOrderUpdate) {
          onOrderUpdate();
        }
      }, 1000);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.details?.message ||
        err.response?.data?.error ||
        err.response?.data?.customerMessage ||
        err.message ||
        "Error processing return request";

      toast.error(`❌ Return Failed: ${errorMessage}`, { autoClose: 5000 });
    } finally {
      setLoadingReturnId(null);
    }
  };

  // ✅ FIXED: handleBulkReturn with multiple shipments support
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
      let totalSuccessCount = 0;
      let totalErrorCount = 0;

      for (const order of ordersToReturn) {
        try {
          const selectedProductIndices = selectedProductsPerOrder[order._id] || [];
          if (selectedProductIndices.length === 0) {
            totalErrorCount++;
            continue;
          }

          let successCount = 0;
          let errorCount = 0;

          // ✅ NEW: Create return for each selected product with quantity support
          for (const productIdx of selectedProductIndices) {
            const item = order.products[productIdx];
            const selectedQty = selectedReturnQuantities[order._id]?.[productIdx] || 1;

            // Create a return request for EACH quantity (Ekart only allows qty 1 per shipment)
            for (let i = 0; i < selectedQty; i++) {
              const productsToReturn = [{
                ...item,
                quantity: 1, // ✅ Ekart constraint: always 1
                smart_checks: item.smart_checks || [],
                uploadedImageUrl: item.uploadedImageUrl || "",
                imageUrl: item.imageUrl || "",
              }];

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
                hsnCode: order.hsnCode || order.hsn || "",
                invoiceReference: order.invoiceReference || order.invoiceId || "",
                destinationName: order.destinationName || "",
                destinationAddressLine1: order.destinationAddressLine1 || "",
                destinationAddressLine2: order.destinationAddressLine2 || "",
                destinationCity: order.destinationCity || "",
                destinationState: order.destinationState || "",
                destinationPincode: order.destinationPincode || "",
                destinationPhone: order.destinationPhone || "",
              };

              try {
                const response = await axios.post(`${API_URL}/api/ekart/return`, payload);

                if (response.data?.success) {
                  successCount++;
                } else {
                  errorCount++;
                }
              } catch (itemError) {
                errorCount++;
              }
            }
          }

          // Update order if at least one return succeeded
          if (successCount > 0) {
            setLocalOrders((prev) =>
              prev.map((o) =>
                o._id === order._id
                  ? {
                      ...o,
                      status: "RETURN_REQUESTED",
                      trackingLoading: false,
                      updatedAt: new Date().toISOString(),
                    }
                  : o
              )
            );

            totalSuccessCount += successCount;

            setSelectedProductsPerOrder((prev) => {
              const updated = { ...prev };
              delete updated[order._id];
              return updated;
            });

            // ✅ Clear quantities after successful bulk return
            setSelectedReturnQuantities((prev) => {
              const updated = { ...prev };
              delete updated[order._id];
              return updated;
            });
          } else {
            totalErrorCount++;
          }
        } catch (orderError) {
          console.error("Bulk return order error:", orderError);
          totalErrorCount++;
        }
      }

      if (onOrderUpdate) {
        onOrderUpdate();
      }

      setSelectedOrderIds([]);

      if (totalSuccessCount > 0) {
        toast.success(
          `✅ Successfully created ${totalSuccessCount} return shipment(s) across selected orders`,
          { autoClose: 5000 }
        );
      }
      if (totalErrorCount > 0) {
        toast.error(
          `⚠️ Some return shipments failed (${totalErrorCount}). You can retry by clicking the Return button again.`,
          { autoClose: 5000 }
        );
      }
    } catch (err) {
      console.error("Bulk return error:", err);
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
      </div>
    );
  }

  return (
    <>
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
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order._id)}
                      onChange={() => toggleSelectOrder(order._id)}
                    />
                  </td>

                  <td>
                    <strong>{order.orderId.startsWith("#") ? order.orderId : `#${order.orderId}`}</strong>
                  </td>

                  <td>{formatDate(order.orderDate)}</td>

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
                          />
                          <div className="product-info">
                            <strong>{p.productName}</strong> <span className="qty">(Qty: {p.quantity})</span>
                            {p.quantity > 1 && (
                              <select
                                value={selectedReturnQuantities[order._id]?.[i] || 1}
                                onChange={(e) =>
                                  updateReturnQuantity(order._id, i, Number(e.target.value))
                                }
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
                              />
                            </div>
                          )}
                          <div className="product-upload">
                            {p.previewImage && (
                              <div className="manual-image-container">
                                <img
                                  src={p.previewImage}
                                  alt="Preview"
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
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>

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

                  <td>
                    <strong>₹{order.amount}</strong>
                  </td>

                  <td>{order.paymentMode}</td>

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

                  <td>{order.hsnCode || order.hsn || "-"}</td>

                  <td>{order.invoiceReference || order.invoiceId || "-"}</td>

                  <td>{order.serviceTier || "-"}</td>

                  <td>{order.category || "-"}</td>

                  <td>{order.unitPrice ? `₹${order.unitPrice}` : "-"}</td>

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
                            <code style={{ fontSize: "11px", backgroundColor: "#f3f4f6", padding: "1px 4px", borderRadius: "3px" }}>
                              {order.returnTracking.ekartTrackingId}
                            </code>
                          </div>
                          <div className="current-status">
                            <strong>Status:</strong>
                            <span>{order.returnTracking.currentStatus}</span>
                          </div>
                          {order.returnTracking.lastUpdated && (
                            <div className="last-updated" style={{ fontSize: "11px", color: "#666" }}>
                              Updated: {formatDateTime(order.returnTracking.lastUpdated)}
                            </div>
                          )}

                          {shouldShowRetryButton(order) && (
                            <div
                              style={{
                                marginTop: "8px",
                                paddingTop: "8px",
                                borderTop: "1px solid #e5e7eb",
                                backgroundColor: "#fef3c7",
                                padding: "8px",
                                borderRadius: "4px",
                                borderLeft: "3px solid #f59e0b",
                              }}
                            >
                              <div style={{ color: "#dc2626", fontSize: "13px", marginBottom: "6px" }}>
                                ⚠️ Pickup was cancelled by Ekart
                              </div>
                              <button
                                onClick={() => handleRetryPickup(order)}
                                disabled={loadingReturnId === `retry-${order._id}`}
                                style={{
                                  width: "100%",
                                  backgroundColor: "#f59e0b",
                                  color: "white",
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: loadingReturnId === `retry-${order._id}` ? "not-allowed" : "pointer",
                                  fontSize: "13px",
                                  fontWeight: "500",
                                }}
                              >
                                {loadingReturnId === `retry-${order._id}`
                                  ? "⏳ Rescheduling..."
                                  : "🔄 Reschedule Pickup"}
                              </button>
                              <p style={{ fontSize: "11px", color: "#666", marginTop: "4px", margin: "4px 0 0 0" }}>
                                Ekart will schedule new pickup
                              </p>
                            </div>
                          )}

                          {!shouldShowRetryButton(order) && (
                            <button
                              onClick={() => refreshTracking(order.orderId)}
                              disabled={order.trackingLoading}
                              style={{
                                marginTop: "6px",
                                padding: "4px 8px",
                                fontSize: "12px",
                                backgroundColor: "#dbeafe",
                                border: "1px solid #93c5fd",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              {order.trackingLoading ? "⏳" : "🔄"} Refresh
                            </button>
                          )}

                          {order.returnTracking.history && order.returnTracking.history.length > 0 && (
                            <details style={{ marginTop: "6px" }}>
                              <summary style={{ fontSize: "12px", cursor: "pointer" }}>
                                History ({order.returnTracking.history.length})
                              </summary>
                              <div style={{ fontSize: "11px", marginTop: "4px" }}>
                                {order.returnTracking.history.slice(0, 5).map((h, i) => (
                                  <div key={i} style={{ marginBottom: "4px", paddingLeft: "8px", borderLeft: "2px solid #e5e7eb" }}>
                                    <div>{h.status}</div>
                                    <div>{formatDateTime(h.timestamp)}</div>
                                    {h.city && <div>📍 {h.city}</div>}
                                    {h.description && <div>{h.description}</div>}
                                  </div>
                                ))}
                                {order.returnTracking.history.length > 5 && (
                                  <div style={{ color: "#666", fontSize: "11px" }}>
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

                  <td className="action-cell">
                    <div style={{ display: "flex", gap: "4px" }}>
                      {/* ✅ FIXED: Return button ALWAYS clickable */}
                      <button
                        style={{
                          backgroundColor: "#ea580c",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: "none",
                          cursor: loadingReturnId === order._id ? "not-allowed" : "pointer",
                          fontSize: "13px",
                          opacity: loadingReturnId === order._id ? 0.7 : 1,
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => handleReturnClick(order)}
                        disabled={loadingReturnId === order._id}
                        title={
                          order.status === "RETURN_REQUESTED"
                            ? "Retry return (previous attempt was made)"
                            : "Create new return request"
                        }
                      >
                        {loadingReturnId === order._id 
                          ? "⏳ Processing..." 
                          : order.status === "RETURN_REQUESTED"
                            ? "🔄 Retry Return"
                            : "🔄 Return"}
                      </button>

                      <button
                        style={{
                          backgroundColor: "#e5e7eb",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          const rect = e.target.getBoundingClientRect();
                          setMenuOpen({
                            id: order._id,
                            top: rect.bottom,
                            left: rect.left,
                          });
                        }}
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

      <div className="pagination-controls">
        <div className="pagination-buttons">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
            ⏮ First
          </button>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
            ◀ Prev
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
            Next ▶
          </button>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
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
          <ActionMenu order={localOrders.find((o) => o._id === menuOpen.id)} onAction={onAction} />
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