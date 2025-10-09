import React, { useState, useEffect } from "react";
import Select from "react-select";
import { MdDelete } from "react-icons/md";
import { toast } from "react-toastify";
import "./OrderForm.css";

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


// All fields reflected from backend schema!
const initialOrder = {
  shopifyId: "",
  orderId: "",
  orderDate: "",
  awb: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  city: "",
  state: "",
  pincode: "",
  products: [{ productName: "", quantity: 1 }],
  deadWeight: "",
  length: "",
  breadth: "",
  height: "",
  volumetricWeight: "",
  amount: "",
  paymentMode: "",
  cgst: "",
  sgst: "",
  igst: "",
  hsnCode: "",
  gstinNumber: "",
  category: "",
  unitPrice: "",
  pickupAddress: "",
  pickupCity: "",
  pickupState: "",
  pickupPincode: "",
  returnLabel1: "",
  returnLabel2: "",
  serviceTier: "",
  invoiceReference: "",
  ekartResponse: "",
  status: "New",
  returnTracking: {
    currentStatus: "",
    history: [],
    ekartTrackingId: "",
  },
};

export default function OrderForm({ onSave, onClose, editData }) {
  const [order, setOrder] = useState(initialOrder);

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
              }))
            : [{ productName: "", quantity: 1 }],
        deadWeight: editData.deadWeight ?? "",
        length: editData.length ?? "",
        breadth: editData.breadth ?? "",
        height: editData.height ?? "",
        volumetricWeight: editData.volumetricWeight ?? "",
        amount: editData.amount ?? "",
        cgst: editData.cgst ?? "",
        sgst: editData.sgst ?? "",
        igst: editData.igst ?? "",
        unitPrice: editData.unitPrice ?? "",
        paymentMode: editData.paymentMode ?? "",
        pickupPincode: editData.pickupPincode ?? "",
        status: editData.status || "New",
        returnTracking: {
          currentStatus: editData.returnTracking?.currentStatus ?? "",
          history: editData.returnTracking?.history ?? [],
          ekartTrackingId: editData.returnTracking?.ekartTrackingId ?? "",
        },
      });
    } else {
      setOrder(initialOrder);
    }
  }, [editData]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    // Numeric fields
    const numberFields = [
      "deadWeight", "length", "breadth", "height",
      "volumetricWeight", "amount", "cgst", "sgst", "igst", "unitPrice"
    ];
    setOrder({
      ...order,
      [name]: numberFields.includes(name)
        ? value === "" ? "" : Number(value)
        : value,
    });
  };

  // For nested returnTracking
  const handleTrackingChange = (e) => {
    const { name, value } = e.target;
    setOrder({
      ...order,
      returnTracking: {
        ...order.returnTracking,
        [name]: value,
      }
    });
  };

  const handleProductChange = (i, field, value) => {
    const newProducts = [...order.products];
    newProducts[i] = {
      ...newProducts[i],
      [field]: field === "quantity" ? (value === "" ? "" : Number(value)) : value,
    };
    setOrder({ ...order, products: newProducts });
  };

  const addProduct = () => {
    setOrder({
      ...order,
      products: [...order.products, { productName: "", quantity: 1 }],
    });
  };

  const removeProduct = (i) => {
    const filtered = [...order.products];
    filtered.splice(i, 1);
    setOrder({ ...order, products: filtered });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Only valid products
    const payload = {
      ...order,
      products: order.products.filter(
        (item) => item.productName.trim() && item.quantity > 0
      ),
      orderDate: order.orderDate ? new Date(order.orderDate) : undefined,
      deadWeight: order.deadWeight === "" ? undefined : Number(order.deadWeight),
      length: order.length === "" ? undefined : Number(order.length),
      breadth: order.breadth === "" ? undefined : Number(order.breadth),
      height: order.height === "" ? undefined : Number(order.height),
      volumetricWeight:
        order.volumetricWeight === "" ? undefined : Number(order.volumetricWeight),
      amount: order.amount === "" ? undefined : Number(order.amount),
      cgst: order.cgst === "" ? undefined : Number(order.cgst),
      sgst: order.sgst === "" ? undefined : Number(order.sgst),
      igst: order.igst === "" ? undefined : Number(order.igst),
      unitPrice: order.unitPrice === "" ? undefined : Number(order.unitPrice)
    };
    onSave(payload);

    if (editData) {
      toast.success("✅ Order updated successfully!");
    } else {
      toast.success("✅ Order saved successfully!");
    }
  };

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <button type="button" className="close-btn" onClick={onClose}>x</button>
      <h2>{editData ? "Edit Order" : "New Order"}</h2>
      <div className="form-grid">
        <div>
          <label>Shopify ID:</label>
          <input name="shopifyId" value={order.shopifyId} onChange={handleChange} />
        </div>
        <div>
          <label>Order ID(Required):</label>
          <input name="orderId" value={order.orderId} onChange={handleChange} required />
        </div>
        <div>
          <label>Order Date(Required):</label>
          <input type="date" name="orderDate" value={order.orderDate} onChange={handleChange} required />
        </div>
        <div>
          <label>AWB:</label>
          <input name="awb" value={order.awb} onChange={handleChange} />
        </div>
        <div>
          <label>Customer Name(Required):</label>
          <input name="customerName" value={order.customerName} onChange={handleChange} required />
        </div>
        <div>
          <label>Phone(Required):</label>
          <input name="customerPhone" value={order.customerPhone} onChange={handleChange} required />
        </div>
        <div>
          <label>Address(Required):</label>
          <textarea name="customerAddress" value={order.customerAddress} onChange={handleChange} rows="2" />
        </div>
        <div>
          <label>City(Required):</label>
          <input name="city" value={order.city} onChange={handleChange} />
        </div>
        <div>
          <label>State (Required) :</label>
          <Select
            options={stateOptions}
            value={stateOptions.find((opt) => opt.value === order.state) || null}
            onChange={(selected) =>
              setOrder({ ...order, state: selected ? selected.value : "" })
            }
            isClearable
            isSearchable
            placeholder="Select or type state"
          />
        </div>
        <div>
          <label>Pincode(Required):</label>
          <input name="pincode" value={order.pincode} onChange={handleChange} />
        </div>
      </div>
      <h3>Products(Required)</h3>
      {order.products.map((p, i) => (
        <div key={i} className="product-row">
          <input
            placeholder="Product Name"
            value={p.productName}
            onChange={(e) => handleProductChange(i, "productName", e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Qty"
            value={p.quantity}
            min={1}
            onChange={(e) => handleProductChange(i, "quantity", e.target.value)}
            required
          />
          {order.products.length > 1 && (
            <button type="button" className="delete-btn" onClick={() => removeProduct(i)}>
              <MdDelete />
            </button>
          )}
        </div>
      ))}
      <button className="btn" type="button" onClick={addProduct}>Add Product</button>
      <div className="form-grid">
        <div>
          <label>Dead Weight (Kg):</label>
          <input name="deadWeight" type="number" value={order.deadWeight} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>Length (cm):</label>
          <input name="length" type="number" value={order.length} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>Breadth (cm):</label>
          <input name="breadth" type="number" value={order.breadth} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>Height (cm):</label>
          <input name="height" type="number" value={order.height} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>Amount:</label>
          <input type="number" name="amount" value={order.amount} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>Payment Mode:</label>
          <select name="paymentMode" value={order.paymentMode} onChange={handleChange}>
            <option value="">Select</option>
            <option value="COD">COD</option>
            <option value="Prepaid">Prepaid</option>
          </select>
        </div>
        <div>
          <label>CGST:</label>
          <input name="cgst" type="number" value={order.cgst} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>SGST:</label>
          <input name="sgst" type="number" value={order.sgst} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>IGST:</label>
          <input name="igst" type="number" value={order.igst} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>HSN Code:</label>
          <input name="hsnCode" value={order.hsnCode} onChange={handleChange} />
        </div>
        <div>
          <label>GSTIN Number:</label>
          <input name="gstinNumber" value={order.gstinNumber} onChange={handleChange} />
        </div>
        <div>
          <label>Category:</label>
          <input name="category" value={order.category} onChange={handleChange} />
        </div>
        <div>
          <label>Unit Price:</label>
          <input name="unitPrice" type="number" value={order.unitPrice} onChange={handleChange} min={0} />
        </div>
        <div>
          <label>Pickup Address:</label>
          <textarea name="pickupAddress" value={order.pickupAddress} onChange={handleChange} rows="2" />
        </div>
        <div>
          <label>Pickup City:</label>
          <input name="pickupCity" value={order.pickupCity} onChange={handleChange} />
        </div>
        <div>
          <label>Pickup State:</label>
          <input name="pickupState" value={order.pickupState} onChange={handleChange} />
        </div>
        <div>
          <label>Pickup Pincode:</label>
          <input name="pickupPincode" value={order.pickupPincode} onChange={handleChange} />
        </div>
        <div>
          <label>Return Label 1:</label>
          <input name="returnLabel1" value={order.returnLabel1} onChange={handleChange} />
        </div>
        <div>
          <label>Return Label 2:</label>
          <input name="returnLabel2" value={order.returnLabel2} onChange={handleChange} />
        </div>
        <div>
          <label>Service Tier:</label>
          <input name="serviceTier" value={order.serviceTier} onChange={handleChange} />
        </div>
        <div>
          <label>Invoice Reference:</label>
          <input name="invoiceReference" value={order.invoiceReference} onChange={handleChange} />
        </div>
        <div>
          <label>Status: New</label>
        </div>
      </div>
      <button className="btn" type="submit">{editData ? "Update Order" : "Save Order"}</button>
    </form>
  );
}
