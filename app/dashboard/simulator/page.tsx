"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

interface InstallmentConfig {
  interest: number;
  commerceCost?: number;
}

interface FinancingConfig {
  systemFee: number;
  vat: number;
  installments: Record<string, InstallmentConfig>;
}

export default function CostSimulatorPage() {
  const [config, setConfig] = useState<FinancingConfig | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedInstallment, setSelectedInstallment] = useState("");
  const [result, setResult] = useState<{ client: number; bank: number } | null>(null);

  useEffect(() => {
    const cfgRef = ref(database, "config/financing");
    onValue(cfgRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setConfig(data);
    });
  }, []);

  const calculate = () => {
    if (!config || !amount || !selectedInstallment) return;
    const net = parseFloat(amount);
    const vatRate = config.vat / 100;
    const systemRate = config.systemFee / 100;
    const instCfg = config.installments[selectedInstallment] || { interest: 0 };
    const catRate = (instCfg.interest || 0) / 100;
    const promoRate = (instCfg.commerceCost || 0) / 100;

    const vatAmount = net * vatRate;
    const systemFee = (net + vatAmount) * systemRate;
    const systemFeeVat = systemFee * vatRate;
    const subtotal = net + vatAmount + systemFee + systemFeeVat;
    const catAmount = subtotal * catRate;
    const totalClient = subtotal + catAmount;
    const bankAmount = net - net * promoRate;

    setResult({ client: totalClient, bank: bankAmount });
  };

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Simulador de Costos</h1>
        <Input
          type="number"
          placeholder="Monto neto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select value={selectedInstallment} onValueChange={setSelectedInstallment}>
          <SelectTrigger>
            <SelectValue placeholder="Cuotas" />
          </SelectTrigger>
          <SelectContent>
            {config &&
              config.installments &&
              Object.keys(config.installments).map((count) => (
                <SelectItem key={count} value={count}>
                  {count} cuotas
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button onClick={calculate}>Calcular</Button>
        {result && (
          <div className="space-y-2">
            <p>
              Monto a cobrar al cliente: ${" "}
              {result.client.toFixed(2)}
            </p>
            <p>
              Monto a recibir en el banco: ${" "}
              {result.bank.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

