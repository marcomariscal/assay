# @version 0.2.15

# Minimalized Curve-style pool snippet highlighting the Vyper nonreentrant bug.
# In affected Vyper versions, @nonreentrant("lock") could be bypassed.

balances: public(HashMap[address, uint256])

@external
@payable
def deposit():
	self.balances[msg.sender] += msg.value

@external
@nonreentrant("lock")
def remove_liquidity(amount: uint256):
	assert self.balances[msg.sender] >= amount
	# External call before state update; reentrancy guard is ineffective in vulnerable compiler versions.
	self._unsafe_transfer(msg.sender, amount)
	self.balances[msg.sender] -= amount

@internal
def _unsafe_transfer(to: address, amount: uint256):
	raw_call(to, b"", value=amount)
