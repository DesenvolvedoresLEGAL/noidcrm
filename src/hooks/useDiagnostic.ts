import { useState, useCallback } from "react";
import { diagnosticQuestions, getClassificationInfo } from "@/data/diagnosticQuestions";
import type { DiagnosticAnswer, DiagnosticResult, DiagnosticScores } from "@/types/diagnostic";

export function useDiagnostic() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const totalSteps = diagnosticQuestions.length;
  const currentQuestion = diagnosticQuestions[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const selectAnswer = useCallback((optionIndex: number) => {
    const question = diagnosticQuestions[currentStep];
    const option = question.options[optionIndex];
    
    const newAnswer: DiagnosticAnswer = {
      questionId: question.id,
      areaKey: question.areaKey,
      selectedOption: optionIndex,
      points: option.points,
    };

    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === question.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });
  }, [currentStep]);

  const getCurrentAnswer = useCallback(() => {
    return answers.find(a => a.questionId === currentQuestion?.id);
  }, [answers, currentQuestion]);

  const goToNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      calculateResult();
    }
  }, [currentStep, totalSteps]);

  const goToPrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const calculateResult = useCallback(() => {
    const scores: DiagnosticScores = {
      pipeline: 0,
      followup: 0,
      prioritization: 0,
      crm: 0,
      forecast: 0,
      lossAnalysis: 0,
      automation: 0,
    };

    let totalScore = 0;

    answers.forEach(answer => {
      const key = answer.areaKey as keyof DiagnosticScores;
      if (key in scores) {
        scores[key] = answer.points;
        totalScore += answer.points;
      }
    });

    const classification = getClassificationInfo(totalScore).key;

    const diagnosticResult: DiagnosticResult = {
      totalScore,
      classification,
      scores,
      answers,
    };

    setResult(diagnosticResult);
    setIsCompleted(true);
  }, [answers]);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setAnswers([]);
    setIsCompleted(false);
    setResult(null);
  }, []);

  return {
    currentStep,
    totalSteps,
    currentQuestion,
    progress,
    answers,
    isCompleted,
    result,
    selectAnswer,
    getCurrentAnswer,
    goToNext,
    goToPrevious,
    reset,
  };
}
