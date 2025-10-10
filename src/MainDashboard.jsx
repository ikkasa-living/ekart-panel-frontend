import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "./Components/Navbar/Navbar";
import OrderForm from "./Components/OrderForm/OrderForm";
import OrderTable from "./Components/OrderTable/OrderTable";
import UploadCSV from "./Components/UploadCSV/UploadCSV";
import CreateOrder from "./Components/CreateOrder/CreateOrder";
import SearchBar from "./Components/SearchBar/SearchBar";
import StatusTabs from "./Components/StatusTabs/StatusTabs";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [orders, setOrders] = useState([]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editOrderData, setEditOrderData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [loading, setLoading] = useState(false);

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnOrderData, setReturnOrderData] = useState(null);

  /** ✅ Utility: Sort orders (latest first) */
  const sortOrdersByLatest = (orders) => {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  };

  /** ✅ Fetch all orders from backend */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/shopify/orders`);
      const localOrders = Array.isArray(res.data?.data) ? res.data.data : [];
      const sorted = sortOrdersByLatest(localOrders);
      setOrders(sorted);
      console.log("✅ Orders fetched:", sorted.length);
    } catch (err) {
      console.error("❌ Error fetching orders:", err);
      toast.error("Failed to fetch orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** ✅ Sync orders with Shopify */
  const handleSyncOrders = async () => {
    try {
      setLoading(true);
      toast.info("⏳ Syncing Shopify orders...");
      await axios.get(`${API_URL}/api/shopify/sync-orders`);
      await fetchOrders();
      toast.success("✅ Shopify sync completed successfully");
    } catch (err) {
      console.error("❌ Error syncing orders:", err);
      toast.error("❌ Shopify sync failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** ✅ When CSV file uploaded */
  const handleCSVUploaded = (updatedOrders) => {
    if (updatedOrders?.length) {
      setOrders((prev) => {
        const normalize = (id) => id?.toString().trim().replace(/^#/, "");
        const orderMap = new Map();

        prev.forEach((order) => orderMap.set(normalize(order.orderId), order));
        updatedOrders.forEach((updated) => {
          const id = normalize(updated.orderId);
          orderMap.set(id, {
            ...updated,
            orderId: id,
            updatedAt: new Date().toISOString(),
          });
        });

        return sortOrdersByLatest(Array.from(orderMap.values()));
      });
      toast.success(`✅ ${updatedOrders.length} orders updated successfully!`);
    } else {
      fetchOrders();
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /** ✅ Create or update order */
  const handleSaveOrder = async (order) => {
    try {
      setLoading(true);
      if (editOrderData) {
        const res = await axios.put(
          `${API_URL}/api/orders/${editOrderData._id}`,
          { ...editOrderData, ...order }
        );
        setOrders((prev) =>
          sortOrdersByLatest(
            prev.map((o) =>
              o._id === editOrderData._id
                ? { ...res.data.data, updatedAt: new Date().toISOString() }
                : o
            )
          )
        );
        toast.success("✅ Order updated successfully");
      } else {
        const res = await axios.post(`${API_URL}/api/orders`, order);
        const newOrder = { ...res.data.data, updatedAt: new Date().toISOString() };
        setOrders((prev) => sortOrdersByLatest([newOrder, ...prev]));
        toast.success("✅ Order created successfully");
      }
      setShowOrderForm(false);
      setEditOrderData(null);
    } catch (err) {
      console.error("❌ Error saving order:", err);
      toast.error("❌ Failed to save order");
    } finally {
      setLoading(false);
    }
  };

  /** ✅ Return order submit handler */
  const handleReturnOrderSubmit = async (orderData) => {
    try {
      setLoading(true);
      const res = await axios.put(`${API_URL}/api/orders/${orderData._id}`, orderData);
      setOrders((prev) =>
        sortOrdersByLatest(
          prev.map((o) =>
            o._id === orderData._id
              ? { ...res.data.data, updatedAt: new Date().toISOString() }
              : o
          )
        )
      );
      toast.success("✅ Return info saved successfully");
      setSelectedStatus("AlreadyReturned");
    } catch (err) {
      console.error("❌ Error saving return data:", err);
      toast.error("Failed to save return data");
    } finally {
      setLoading(false);
    }
  };

  /** ✅ Handle actions (edit, delete, clone, etc.) */
  const handleAction = async (action, order) => {
    try {
      setLoading(true);
      if (action === "editOrder") {
        setEditOrderData(order);
        setShowOrderForm(true);
      } else if (action === "addTag") {
        const tag = prompt("Enter tag:");
        if (tag) {
          const res = await axios.put(`${API_URL}/api/orders/${order._id}`, {
            ...order,
            tag,
            updatedAt: new Date().toISOString(),
          });
          setOrders((prev) =>
            sortOrdersByLatest(
              prev.map((o) =>
                o._id === order._id
                  ? { ...res.data.data, updatedAt: new Date().toISOString() }
                  : o
              )
            )
          );
          toast.success(`✅ Tag '${tag}' added successfully`);
        }
      } else if (action === "cloneOrder") {
        const clonedOrder = {
          ...order,
          orderId: `${order.orderId || order._id}-CLONE-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        delete clonedOrder._id;
        const res = await axios.post(`${API_URL}/api/orders`, clonedOrder);
        setOrders((prev) =>
          sortOrdersByLatest([{ ...res.data.data }, ...prev])
        );
        toast.success("✅ Order cloned successfully");
      } else if (action === "deleteOrder") {
        if (window.confirm("Are you sure you want to delete this order?")) {
          await axios.delete(`${API_URL}/api/orders/${order._id}`);
          setOrders((prev) => prev.filter((o) => o._id !== order._id));
          toast.success("✅ Order deleted successfully");
        }
      }
    } catch (err) {
      console.error("❌ Error in action:", err);
      toast.error("❌ Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** ✅ Filter and sort orders */
  const filteredOrders = sortOrdersByLatest(
    orders.filter((order) => {
      const matchSearch = JSON.stringify(order)
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      let statusMatch = true;
      if (selectedStatus === "AlreadyReturned") {
        statusMatch =
          order.returnTracking &&
          ["return_delivered", "returned_to_seller"].includes(
            order.returnTracking.currentStatus
          );
      } else if (selectedStatus === "TrackingActive") {
        statusMatch =
          order.returnTracking?.ekartTrackingId &&
          order.returnTracking.currentStatus &&
          !["return_delivered", "returned_to_seller", "cancelled"].includes(
            order.returnTracking.currentStatus
          );
      } else if (selectedStatus !== "All") {
        const s = order.status || "New";
        statusMatch = s === selectedStatus;
      }
      return matchSearch && statusMatch;
    })
  );

  /** ✅ Status count helper */
  const getStatusCounts = () => ({
    All: orders.length,
    New: orders.filter((o) => (o.status || "New") === "New").length,
    RETURN_REQUESTED: orders.filter((o) => o.status === "RETURN_REQUESTED").length,
    PROCESSING: orders.filter((o) => o.status === "PROCESSING").length,
    SHIPPED: orders.filter((o) => o.status === "SHIPPED").length,
    DELIVERED: orders.filter((o) => o.status === "DELIVERED").length,
    AlreadyReturned: orders.filter(
      (o) =>
        o.returnTracking &&
        ["return_delivered", "returned_to_seller"].includes(
          o.returnTracking.currentStatus
        )
    ).length,
    TrackingActive: orders.filter(
      (o) =>
        o.returnTracking?.ekartTrackingId &&
        o.returnTracking.currentStatus &&
        !["return_delivered", "returned_to_seller", "cancelled"].includes(
          o.returnTracking.currentStatus
        )
    ).length,
  });

  const statusCounts = getStatusCounts();

  return (
    <>
      <Navbar />
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <StatusTabs
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        statusCounts={statusCounts}
      />

      <div className="order-actions">
        <CreateOrder
          onClick={() => {
            setEditOrderData(null);
            setShowOrderForm(true);
          }}
        />
        <UploadCSV onUploaded={handleCSVUploaded} />
        <button
          className="sync-btn"
          onClick={handleSyncOrders}
          disabled={loading}
          style={{ marginLeft: 12 }}
        >
          {loading ? "⏳ Syncing..." : "🔄 Sync Shopify Orders"}
        </button>
        {filteredOrders.length > 0 && (
          <span style={{ marginLeft: 12, color: "#666" }}>
            Showing {filteredOrders.length} of {orders.length} orders
          </span>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p>⏳ Loading orders...</p>
        </div>
      )}

      <OrderTable
        orders={filteredOrders}
        onAction={handleAction}
        onOrderUpdate={fetchOrders}
        loading={loading}
      />

      {showOrderForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <OrderForm
              onSave={handleSaveOrder}
              onClose={() => {
                setShowOrderForm(false);
                setEditOrderData(null);
              }}
              editData={editOrderData}
            />
          </div>
        </div>
      )}

      {showReturnForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <ReturnOrderForm
              order={returnOrderData}
              onClose={() => setShowReturnForm(false)}
              onSave={handleReturnOrderSubmit}
            />
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={4000} theme="colored" />
    </>
  );
}
