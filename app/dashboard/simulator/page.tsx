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
  const [result, setResult] =
    useState<
      | {
          client: number;
          bank: number;
          vat: number;
          system: number;
          posnet: number;
          installments: number;
          perInstallment: number;
        }
      | null
    >(null);

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
    const desiredAmount = net + vatAmount;
    const baseAmount =
      desiredAmount / (1 - systemRate * (1 + vatRate));
    const systemCharge = baseAmount - desiredAmount;
    const catAmount = baseAmount * catRate;
    const totalClient = baseAmount + catAmount;
    const bankAmount = desiredAmount - net * promoRate;
    const installments = parseInt(selectedInstallment, 10);
    const perInstallment = totalClient / installments;

    setResult({
      client: totalClient,
      bank: bankAmount,
      vat: vatAmount,
      system: systemCharge,
      posnet: baseAmount,
      installments,
      perInstallment,
    });
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
            <p className="text-xl font-semibold">
              Monto a pasar en el posnet: ${" "}
              {result.posnet.toFixed(2)}
            </p>
            <p>IVA: ${result.vat.toFixed(2)}</p>
            <p>
              Cargo del sistema (4.9% + IVA): $
              {result.system.toFixed(2)}
            </p>
            <p>
              Total a pagar ({result.installments} cuotas): ${" "}
              {result.client.toFixed(2)}
            </p>
            <p>
              Valor por cuota: ${" "}
              {result.perInstallment.toFixed(2)}
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

