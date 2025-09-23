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
  label?: string;
}

interface CardConfig {
  name: string;
  installments: Record<string, InstallmentConfig>;
}

interface FinancingConfig {
  systemFee: number;
  vat: number;
  grossIncome: number;
  cards: Record<string, CardConfig>;
  installments?: Record<string, InstallmentConfig>; // Legacy support
}

export default function CostSimulatorPage() {
  const [config, setConfig] = useState<FinancingConfig | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedCard, setSelectedCard] = useState("");
  const [selectedInstallment, setSelectedInstallment] = useState("");
  const [result, setResult] =
    useState<
      | {
          client: number;
          bank: number;
          vat: number;
          system: number;
          posnet: number;
          grossIncome: number;
          installments: number;
          perInstallment: number;
        }
      | null
    >(null);

  useEffect(() => {
    const cfgRef = ref(database, "config/financing");
    const unsubscribe = onValue(cfgRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      let normalized: FinancingConfig;
      if (data.cards) {
        normalized = {
          systemFee: data.systemFee ?? 0,
          vat: data.vat ?? 0,
          grossIncome: data.grossIncome ?? 0,
          cards: data.cards as Record<string, CardConfig>,
          installments: data.installments,
        };
      } else {
        normalized = {
          systemFee: data.systemFee ?? 0,
          vat: data.vat ?? 0,
          grossIncome: data.grossIncome ?? 0,
          cards: {
            general: {
              name: "General",
              installments: data.installments ?? {},
            },
          },
          installments: data.installments,
        };
      }

      setConfig(normalized);
      setSelectedCard((prev) => {
        if (prev && normalized.cards[prev]) return prev;
        const [firstCard] = Object.keys(normalized.cards);
        return firstCard ?? "";
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!config || !selectedCard) return;
    const card = config.cards[selectedCard];
    if (!card) return;

    setSelectedInstallment((prev) => {
      if (prev && card.installments[prev]) return prev;
      const [firstInstallment] = Object.keys(card.installments);
      return firstInstallment ?? "";
    });
  }, [config, selectedCard]);

  const calculate = () => {
    if (!config || !amount || !selectedCard || !selectedInstallment) return;
    const net = parseFloat(amount);
    const vatRate = config.vat / 100;
    const systemRate = config.systemFee / 100;
    const card = config.cards[selectedCard];
    if (!card) return;

    const instCfg = card.installments[selectedInstallment] || { interest: 0 };
    const catRate = (instCfg.interest || 0) / 100;
    const promoRate = (instCfg.commerceCost || 0) / 100;

    const vatAmount = net * vatRate;
    const grossIncomeRate = (config.grossIncome ?? 0) / 100;
    const grossIncomeBase = net + vatAmount;
    const grossIncomeAmount = grossIncomeBase * grossIncomeRate;
    const desiredAmount = grossIncomeBase + grossIncomeAmount;
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
      grossIncome: grossIncomeAmount,
      installments,
      perInstallment,
    });
  };

  const currentCard = selectedCard && config ? config.cards[selectedCard] : undefined;
  const hasCards = !!(config && Object.keys(config.cards).length);
  const hasInstallments = !!(
    currentCard && Object.keys(currentCard.installments).length
  );

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
        <Select
          value={selectedCard}
          onValueChange={setSelectedCard}
          disabled={!hasCards}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tarjeta" />
          </SelectTrigger>
          <SelectContent>
            {config &&
              Object.entries(config.cards).map(([cardId, cardOption]) => (
                <SelectItem key={cardId} value={cardId}>
                  {cardOption.name || "Sin nombre"}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedInstallment}
          onValueChange={setSelectedInstallment}
          disabled={!hasInstallments}
        >
          <SelectTrigger>
            <SelectValue placeholder="Cuotas" />
          </SelectTrigger>
          <SelectContent>
            {currentCard &&
              Object.entries(currentCard.installments).map(([count, data]) => (
                <SelectItem key={count} value={count}>
                  {data.label
                    ? `${data.label} (${count} cuotas)`
                    : `${count} cuotas`}
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
              Cargo del sistema ({config?.systemFee ?? 0}% + IVA): $
              {result.system.toFixed(2)}
            </p>
            <p>
              Ingresos Brutos ({config?.grossIncome ?? 0}%): $
              {result.grossIncome.toFixed(2)}
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

