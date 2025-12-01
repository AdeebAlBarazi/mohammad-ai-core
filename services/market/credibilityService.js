'use strict';

function computeFinalScore({ vendorRating=0, warehouseRating=0, employeeRating=0, mediaQuality=0, responseRate=0, fulfillmentSpeed=0, returnRate=0 }){
  const score = (vendorRating * 0.35) +
                (warehouseRating * 0.20) +
                (employeeRating * 0.10) +
                (mediaQuality * 0.10) +
                (responseRate * 0.10) +
                (fulfillmentSpeed * 0.10) +
                ((1 - returnRate) * 0.05);
  return +score.toFixed(3);
}

module.exports = { computeFinalScore };