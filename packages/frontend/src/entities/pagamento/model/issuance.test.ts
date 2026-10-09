import {describe,expect,it} from "vitest";
import {getBoletoIssuanceFeedback} from "./issuance";
describe("boleto issuance feedback",()=>{
 it("does not offer an old PDF while issuance is queued",()=>{
  expect(getBoletoIssuanceFeedback(202,{boleto:{metadata:{pdfUrl:"https://example.test/old.pdf"}}})).toEqual({pending:true,message:"Solicitação registrada. O boleto está em processamento.",pdfUrl:null});
  expect(getBoletoIssuanceFeedback(200,{boleto:{processing:"PENDING"}}).pending).toBe(true);
 });
 it("offers the returned PDF only after completed issuance",()=>{
  expect(getBoletoIssuanceFeedback(200,{boleto:{processing:"READY",metadata:{pdfUrl:"https://example.test/new.pdf"}}})).toEqual(expect.objectContaining({pending:false,pdfUrl:"https://example.test/new.pdf"}));
 });
});
