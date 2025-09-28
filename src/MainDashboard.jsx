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

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/shopify/orders`);
      const localOrders = Array.isArray(res.data?.data) ? res.data.data : [];
      setOrders(localOrders);
      console.log("✅ Orders fetched:", localOrders.length, "orders");
    } catch (err) {
      console.error("❌ Error fetching orders:", err);
      toast.error("Failed to fetch orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

  const handleCSVUploaded = async () => {
    await fetchOrders();
    toast.success("✅ File uploaded and orders refreshed");
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSaveOrder = async (order) => {
    try {
      setLoading(true);
      if (editOrderData) {
        const res = await axios.put(`${API_URL}/api/orders/${editOrderData._id}`, order);
        setOrders(orders.map((o) => (o._id === editOrderData._id ? res.data.data : o)));
        toast.success("✅ Order updated successfully");
      } else {
        const res = await axios.post(`${API_URL}/api/orders`, order);
        setOrders([res.data.data, ...orders]);
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

  const handleAction = async (action, order) => {
    try {
      setLoading(true);
      if (action === "editOrder") {
        setEditOrderData(order);
        setShowOrderForm(true);
      } else if (action === "forwardShip") {
        toast.info(`Forward shipping initiated for order ${order.orderId}`);
      } else if (action === "reverseShip") {
        toast.info(`Reverse shipping initiated for order ${order.orderId}`);
      } else if (action === "addTag") {
        const tag = prompt("Enter tag:");
        if (tag) {
          const updated = { ...order, tag };
          const res = await axios.put(`${API_URL}/api/orders/${order._id}`, updated);
          setOrders(orders.map((o) => (o._id === order._id ? res.data.data : o)));
          toast.success(`✅ Tag '${tag}' added successfully`);
        }
      } else if (action === "cloneOrder") {
        const clonedOrder = {
          ...order,
          orderId: (order.orderId || order._id) + "-CLONE-" + Date.now(),
        };
        delete clonedOrder._id;
        const res = await axios.post(`${API_URL}/api/orders`, clonedOrder);
        setOrders([res.data.data, ...orders]);
        toast.success("✅ Order cloned successfully");
      } else if (action === "deleteOrder") {
        if (window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
          await axios.delete(`${API_URL}/api/orders/${order._id}`);
          setOrders(orders.filter((o) => o._id !== order._id));
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

  const filteredOrders = orders.filter((order) => {
    const orderString = JSON.stringify(order).toLowerCase();
    const searchMatch = orderString.includes(searchTerm.toLowerCase());

    let statusMatch = true;
    if (selectedStatus !== "All") {
      const orderStatus = order.status || "New";
      statusMatch = orderStatus === selectedStatus;
    }

    return searchMatch && statusMatch;
  });

  const getStatusCounts = () => {
    const counts = {
      All: orders.length,
      New: orders.filter(o => (o.status || "New") === "New").length,
      RETURN_REQUESTED: orders.filter(o => o.status === "RETURN_REQUESTED").length,
      PROCESSING: orders.filter(o => o.status === "PROCESSING").length,
      SHIPPED: orders.filter(o => o.status === "SHIPPED").length,
      DELIVERED: orders.filter(o => o.status === "DELIVERED").length,
    };
    return counts;
  };

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
